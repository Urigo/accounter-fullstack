import { config } from 'dotenv';
import pg from 'pg';
import { buildSecurityBusinessName } from '../packages/server/src/modules/foreign-securities/helpers/security-business-name.helper.js';
import { extractSecurityKeys } from '../packages/server/src/modules/foreign-securities/helpers/security-key.helper.js';
import { formatCurrency } from '../packages/server/src/shared/helpers/amount.js';

config();

/**
 * One-time backfill for per-security businesses.
 *
 * Two steps, both idempotent and safe to re-run:
 *
 * 1. **Create a business per ISIN** out of the already-ingested executions in
 *    `accounter_schema.poalim_securities_transactions`, with a `POALIM_SECURITY_KEY`
 *    identifier for every Poalim key seen reporting that ISIN. This is what ingestion now does
 *    for new arrivals; the script is for history that predates it.
 * 2. **Re-point existing transactions** from the general foreign-securities business to the
 *    specific security, where the description names exactly one key that resolves. Only
 *    transactions currently pointing at the general business are touched — anything else is a
 *    human decision this script has no business overwriting — and only non-fee rows, since the
 *    fee side stays with the bank.
 *
 * Dry-run by default: `--apply` writes. `--owner=<uuid>` limits the run to one tenant.
 *
 *     yarn tsx scripts/backfill-security-businesses.ts            # report only
 *     yarn tsx scripts/backfill-security-businesses.ts --apply
 *
 * Executions with no ISIN are left alone: the ISIN is the identity, and it cannot be invented
 * from the Poalim key. They are counted in the report and assigned by hand from the charge UI.
 */

type Args = { apply: boolean; ownerId: string | null };

function parseArgs(argv: string[]): Args {
  const ownerArg = argv.find(arg => arg.startsWith('--owner='));
  return {
    apply: argv.includes('--apply'),
    ownerId: ownerArg ? ownerArg.slice('--owner='.length) : null,
  };
}

type SecurityGroup = {
  isin: string;
  poalimKeys: Set<string>;
  descriptors: {
    symbol: string | null;
    engName: string | null;
    hebName: string | null;
    exchange: string | null;
    currencyCode: string | null;
    issuerCountryCode: string | null;
  };
};

type OwnerReport = {
  ownerId: string;
  securitiesCreated: string[];
  identifiersLinked: number;
  transactionsRepointed: number;
  keysWithoutIsin: string[];
  ambiguousDescriptions: string[];
  unresolvedKeys: string[];
};

const SCHEMA = 'accounter_schema';

/** Stands in for the id a business would have been given, so a dry run can count the work. */
const DRY_RUN_PREFIX = 'dry-run:';

/**
 * Runs a group of dependent writes as one unit. A security is three inserts across
 * financial_entities, businesses and businesses_securities: a failure part-way through would
 * leave a business that is not a security, which the ISIN lookup would never find again and a
 * re-run would happily duplicate — so the script would stop being safe to re-run, which is the
 * one thing it promises.
 */
async function inTransaction<T>(client: pg.Client, write: () => Promise<T>): Promise<T> {
  await client.query('BEGIN');
  try {
    const result = await write();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * `businesses_securities.currency_code` is the closed `accounter_schema.currency` type, while
 * the executions report whatever the feed said — Poalim spells its currencies out in Hebrew.
 * Same normalization the ingestion provider does; an unrecognized label leaves the column empty
 * rather than failing the insert.
 */
function toCurrency(rawCurrency: string | null): string | null {
  const label = rawCurrency?.trim();
  return label ? formatCurrency(label, true) : null;
}

async function ownersToProcess(client: pg.Client, ownerId: string | null): Promise<string[]> {
  if (ownerId) {
    return [ownerId];
  }
  const { rows } = await client.query<{ owner_id: string }>(
    `SELECT DISTINCT owner_id FROM ${SCHEMA}.poalim_securities_transactions ORDER BY owner_id`,
  );
  return rows.map(row => row.owner_id);
}

/**
 * The tenant's own RLS context, exactly as the server sets it per request. Needed whether or
 * not the connecting role bypasses RLS, so the script behaves the same in both.
 */
async function actAsTenant(client: pg.Client, ownerId: string): Promise<void> {
  await client.query(`SELECT set_config('app.current_business_id', $1, false)`, [ownerId]);
}

async function groupExecutionsBySecurity(
  client: pg.Client,
  ownerId: string,
): Promise<{ groups: Map<string, SecurityGroup>; keysWithoutIsin: string[] }> {
  const { rows } = await client.query<{
    isin: string | null;
    security: string;
    symbol: string | null;
    eng_name: string | null;
    heb_name: string | null;
    issuer_exchange: string | null;
    trade_currency: string | null;
    issuer_country_code: string | null;
  }>(
    `SELECT DISTINCT ON (security, isin)
            isin, security, symbol, eng_name, heb_name, issuer_exchange,
            trade_currency, issuer_country_code
     FROM ${SCHEMA}.poalim_securities_transactions
     WHERE owner_id = $1
     ORDER BY security, isin, trade_date DESC`,
    [ownerId],
  );

  const groups = new Map<string, SecurityGroup>();
  const keysWithoutIsin = new Set<string>();

  for (const row of rows) {
    const isin = row.isin?.trim();
    if (!isin) {
      keysWithoutIsin.add(row.security);
      continue;
    }

    let group = groups.get(isin);
    if (!group) {
      group = {
        isin,
        poalimKeys: new Set(),
        descriptors: {
          symbol: row.symbol,
          engName: row.eng_name,
          hebName: row.heb_name,
          exchange: row.issuer_exchange,
          currencyCode: row.trade_currency,
          issuerCountryCode: row.issuer_country_code,
        },
      };
      groups.set(isin, group);
    }
    group.poalimKeys.add(row.security);
  }

  // A key that also appears with an ISIN somewhere is not really missing one.
  for (const group of groups.values()) {
    for (const key of group.poalimKeys) {
      keysWithoutIsin.delete(key);
    }
  }

  return { groups, keysWithoutIsin: [...keysWithoutIsin] };
}

/** Sort code, IRS code, country and tax category are inherited from the general business. */
async function generalSecuritiesBusiness(client: pg.Client, ownerId: string) {
  const { rows } = await client.query<{
    id: string | null;
    sort_code: number | null;
    irs_code: number | null;
    country: string | null;
    tax_category_id: string | null;
  }>(
    `SELECT b.id, fe.sort_code, fe.irs_code, b.country, m.tax_category_id
     FROM ${SCHEMA}.user_context uc
     INNER JOIN ${SCHEMA}.businesses b ON b.id = uc.foreign_securities_business_id
     INNER JOIN ${SCHEMA}.financial_entities fe ON fe.id = b.id
     LEFT JOIN ${SCHEMA}.business_tax_category_match m
       ON m.business_id = b.id AND m.owner_id = uc.owner_id
     WHERE uc.owner_id = $1`,
    [ownerId],
  );
  return rows[0] ?? null;
}

async function createSecurityBusiness(
  client: pg.Client,
  ownerId: string,
  group: SecurityGroup,
  general: Awaited<ReturnType<typeof generalSecuritiesBusiness>>,
): Promise<string> {
  const name = buildSecurityBusinessName({
    isin: group.isin,
    engName: group.descriptors.engName,
    symbol: group.descriptors.symbol,
  });

  return inTransaction(client, async () => {
    const {
      rows: [financialEntity],
    } = await client.query<{ id: string }>(
      `INSERT INTO ${SCHEMA}.financial_entities (name, type, owner_id, sort_code, irs_code, is_active)
       VALUES ($1, 'business', $2, $3, $4, true)
       RETURNING id`,
      [name, ownerId, general?.sort_code ?? null, general?.irs_code ?? null],
    );

    await client.query(
      `INSERT INTO ${SCHEMA}.businesses (id, owner_id, country, hebrew_name)
       VALUES ($1, $2, $3, $4)`,
      [financialEntity.id, ownerId, general?.country ?? 'ISR', group.descriptors.hebName],
    );

    await client.query(
      `INSERT INTO ${SCHEMA}.businesses_securities (
         id, owner_id, isin, symbol, eng_name, heb_name, exchange, currency_code,
         is_foreign, issuer_country_code
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)`,
      [
        financialEntity.id,
        ownerId,
        group.isin,
        group.descriptors.symbol,
        group.descriptors.engName,
        group.descriptors.hebName,
        group.descriptors.exchange,
        toCurrency(group.descriptors.currencyCode),
        group.descriptors.issuerCountryCode,
      ],
    );

    if (general?.tax_category_id) {
      await client.query(
        `INSERT INTO ${SCHEMA}.business_tax_category_match (business_id, owner_id, tax_category_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [financialEntity.id, ownerId, general.tax_category_id],
      );
    }

    return financialEntity.id;
  });
}

async function backfillOwner(client: pg.Client, ownerId: string, apply: boolean) {
  const report: OwnerReport = {
    ownerId,
    securitiesCreated: [],
    identifiersLinked: 0,
    transactionsRepointed: 0,
    keysWithoutIsin: [],
    ambiguousDescriptions: [],
    unresolvedKeys: [],
  };

  await actAsTenant(client, ownerId);

  // ── 1. a business per ISIN ────────────────────────────────────────────────
  const { groups, keysWithoutIsin } = await groupExecutionsBySecurity(client, ownerId);
  report.keysWithoutIsin = keysWithoutIsin;

  const { rows: existingRows } = await client.query<{ id: string; isin: string }>(
    `SELECT id, isin FROM ${SCHEMA}.businesses_securities WHERE owner_id = $1`,
    [ownerId],
  );
  const businessByIsin = new Map(existingRows.map(row => [row.isin, row.id]));

  const general = await generalSecuritiesBusiness(client, ownerId);
  if (!general && groups.size > 0) {
    console.warn(
      `  ⚠ owner ${ownerId} has no foreign_securities_business_id; new securities inherit nothing`,
    );
  }

  const businessIdByPoalimKey = new Map<string, string>();

  for (const group of groups.values()) {
    let businessId = businessByIsin.get(group.isin);

    if (!businessId) {
      report.securitiesCreated.push(
        buildSecurityBusinessName({
          isin: group.isin,
          engName: group.descriptors.engName,
          symbol: group.descriptors.symbol,
        }),
      );
      businessId = apply
        ? await createSecurityBusiness(client, ownerId, group, general)
        : `${DRY_RUN_PREFIX}${group.isin}`;
      businessByIsin.set(group.isin, businessId);
    }

    for (const poalimKey of group.poalimKeys) {
      businessIdByPoalimKey.set(poalimKey, businessId);
      if (!apply) {
        report.identifiersLinked += 1;
        continue;
      }
      const { rowCount } = await client.query(
        `INSERT INTO ${SCHEMA}.security_identifiers (owner_id, business_id, identifier_type, identifier_value)
         VALUES ($1, $2, 'POALIM_SECURITY_KEY', $3)
         ON CONFLICT (owner_id, identifier_type, identifier_value) DO NOTHING`,
        [ownerId, businessId, poalimKey],
      );
      report.identifiersLinked += rowCount ?? 0;
    }
  }

  // Identifiers created by an earlier run or by ingestion also resolve step 2.
  const { rows: identifierRows } = await client.query<{
    identifier_value: string;
    business_id: string;
  }>(
    `SELECT identifier_value, business_id
     FROM ${SCHEMA}.security_identifiers
     WHERE owner_id = $1 AND identifier_type = 'POALIM_SECURITY_KEY'`,
    [ownerId],
  );
  for (const row of identifierRows) {
    businessIdByPoalimKey.set(row.identifier_value, row.business_id);
  }

  // ── 2. re-point the trades ────────────────────────────────────────────────
  if (!general?.id) {
    return report;
  }

  const { rows: transactions } = await client.query<{
    id: string;
    source_description: string | null;
  }>(
    `SELECT id, source_description
     FROM ${SCHEMA}.transactions
     WHERE owner_id = $1 AND business_id = $2 AND is_fee = false`,
    [ownerId, general.id],
  );

  for (const transaction of transactions) {
    const keys = extractSecurityKeys(transaction.source_description);
    if (keys.length !== 1) {
      if (keys.length > 1) {
        report.ambiguousDescriptions.push(transaction.source_description ?? transaction.id);
      }
      continue;
    }

    const businessId = businessIdByPoalimKey.get(keys[0]);
    if (!businessId) {
      report.unresolvedKeys.push(keys[0]);
      continue;
    }

    // In a dry run the business it would point at does not exist yet; the count is what
    // --apply would do.
    if (apply) {
      await client.query(`UPDATE ${SCHEMA}.transactions SET business_id = $1 WHERE id = $2`, [
        businessId,
        transaction.id,
      ]);
    }
    report.transactionsRepointed += 1;
  }

  return report;
}

function printReport(report: OwnerReport, apply: boolean) {
  const verb = apply ? '' : 'would be ';
  console.log(`\nOwner ${report.ownerId}`);
  console.log(`  securities ${verb}created:      ${report.securitiesCreated.length}`);
  for (const name of report.securitiesCreated.slice(0, 10)) {
    console.log(`    · ${name}`);
  }
  if (report.securitiesCreated.length > 10) {
    console.log(`    · … and ${report.securitiesCreated.length - 10} more`);
  }
  console.log(`  Poalim keys ${verb}linked:      ${report.identifiersLinked}`);
  console.log(`  transactions ${verb}re-pointed: ${report.transactionsRepointed}`);

  if (report.keysWithoutIsin.length) {
    console.log(
      `  ⚠ ${report.keysWithoutIsin.length} security key(s) report no ISIN — assign by hand: ${report.keysWithoutIsin.slice(0, 10).join(', ')}`,
    );
  }
  if (report.unresolvedKeys.length) {
    console.log(
      `  ⚠ ${report.unresolvedKeys.length} transaction(s) name a key with no security business: ${[...new Set(report.unresolvedKeys)].slice(0, 10).join(', ')}`,
    );
  }
  if (report.ambiguousDescriptions.length) {
    console.log(
      `  ⚠ ${report.ambiguousDescriptions.length} transaction(s) name more than one security and were left alone`,
    );
  }
}

async function main() {
  const { apply, ownerId } = parseArgs(process.argv.slice(2));

  const client = new pg.Client({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL === '1',
  });

  await client.connect();
  console.log(
    `Connected to ${process.env.POSTGRES_DB}@${process.env.POSTGRES_HOST} — ${
      apply ? 'APPLYING CHANGES' : 'dry run, nothing will be written'
    }`,
  );

  try {
    const owners = await ownersToProcess(client, ownerId);
    if (owners.length === 0) {
      console.log('No tenant has ingested securities executions — nothing to do.');
      return;
    }

    for (const owner of owners) {
      const report = await backfillOwner(client, owner, apply);
      printReport(report, apply);
    }

    if (!apply) {
      console.log('\nRe-run with --apply to write these changes.');
    }
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
