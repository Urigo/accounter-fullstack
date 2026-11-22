/**
 * Recreates the e2e database: drops it, migrates a fresh one to the latest migration, then seeds
 * the admin business, the dev-auth user and the charges in `data.ts`.
 *
 * Run before the server starts (see `playwright.config.ts`), so every run starts from the same
 * state, including after a test that writes (the merge test).
 *
 *   node --import ../../scripts/register-esm.js e2e/seed-database.ts
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createPool } from 'slonik';
import { runPGMigrations } from '../../migrations/src/run-pg-migrations.js';
import { seedAdminCore } from '../../server/scripts/seed-admin-context.js';
import { seedCountries } from '../../server/src/modules/countries/helpers/seed-countries.helper.js';
import { addDays, CHARGE_GROUPS, type ChargeGroup } from './data.js';
import { assertE2eDatabase, E2E_USER_ID, e2eDatabase } from './env.js';

async function recreateDatabase(): Promise<void> {
  const admin = new pg.Client({ ...e2eDatabase, database: 'postgres' });
  await admin.connect();
  try {
    // `assertE2eDatabase` restricts the name to `*_e2e`, so quoting it is enough.
    await admin.query(`DROP DATABASE IF EXISTS "${e2eDatabase.database}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${e2eDatabase.database}"`);
  } finally {
    await admin.end();
  }
}

async function migrate(): Promise<void> {
  const { user, password, host, port, database } = e2eDatabase;
  const slonik = await createPool(
    `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`,
  );
  try {
    await runPGMigrations({ slonik });
  } finally {
    await slonik.end();
  }
}

async function insertBusiness(client: pg.Client, ownerId: string, name: string): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
     VALUES ($1, $2, 'business', $3)`,
    [id, name, ownerId],
  );
  await client.query('INSERT INTO accounter_schema.businesses (id, owner_id) VALUES ($1, $2)', [
    id,
    ownerId,
  ]);
  return id;
}

async function seedGroup(
  client: pg.Client,
  ownerId: string,
  accountId: string,
  tagIds: Map<string, string>,
  group: ChargeGroup,
): Promise<void> {
  const counterpartyId = await insertBusiness(client, ownerId, group.counterparty);
  let tagId: string | undefined;
  if (group.tag) {
    tagId = randomUUID();
    await client.query(
      'INSERT INTO accounter_schema.tags (id, name, owner_id) VALUES ($1, $2, $3)',
      [tagId, group.tag.name, ownerId],
    );
    tagIds.set(group.tag.name, tagId);
  }

  for (const [index, description] of group.descriptions.entries()) {
    const chargeId = randomUUID();
    await client.query(
      `INSERT INTO accounter_schema.charges (id, owner_id, user_description)
       VALUES ($1, $2, $3)`,
      [chargeId, ownerId, description],
    );

    // Every transaction needs a raw-list row; an etherscan id is the one source with no trigger.
    const originKey = randomUUID();
    const {
      rows: [raw],
    } = await client.query<{ id: string }>(
      'INSERT INTO accounter_schema.transactions_raw_list (etherscan_id) VALUES ($1) RETURNING id',
      [originKey],
    );
    const date = addDays(group.firstDate, index);
    await client.query(
      `INSERT INTO accounter_schema.transactions (
         id, account_id, charge_id, source_id, source_reference, source_origin, origin_key,
         currency, event_date, debit_date, amount, current_balance, business_id, currency_rate,
         owner_id
       )
       VALUES ($1, $2, $3, $4, $5, 'TEST', $6, 'ILS', $7, $7, $8, 0, $9, 1, $10)`,
      [
        randomUUID(),
        accountId,
        chargeId,
        raw!.id,
        `e2e-${chargeId.slice(0, 8)}`,
        originKey,
        date,
        // Distinct amounts, so a row is recognisable in a screenshot too.
        (-(index + 1) * 10).toFixed(2),
        counterpartyId,
        ownerId,
      ],
    );

    if (tagId && group.tag && (index + 1) % group.tag.every === 0) {
      await client.query(
        'INSERT INTO accounter_schema.charge_tags (charge_id, tag_id, owner_id) VALUES ($1, $2, $3)',
        [chargeId, tagId, ownerId],
      );
    }
  }
}

async function seed(): Promise<void> {
  const client = new pg.Client(e2eDatabase);
  await client.connect();
  try {
    await client.query('BEGIN');
    await seedCountries(client as unknown as pg.PoolClient);
    const { adminEntityId: ownerId } = await seedAdminCore(client);
    // As in `scripts/seed-demo-data.ts`: memberships reference admin businesses. The VAT number
    // and registration date are what the app shell reads about the admin business; without them
    // every page opens with error toasts.
    await client.query(
      `INSERT INTO accounter_schema.businesses_admin (id, owner_id, registration_date)
       VALUES ($1, $1, '2020-01-01')`,
      [ownerId],
    );
    await client.query(
      `UPDATE accounter_schema.businesses SET vat_number = '515000000' WHERE id = $1`,
      [ownerId],
    );

    await client.query(
      `INSERT INTO accounter_schema.business_users (user_id, business_id, role_id)
       VALUES ($1, $2, 'business_owner')`,
      [E2E_USER_ID, ownerId],
    );

    const accountId = randomUUID();
    await client.query(
      `INSERT INTO accounter_schema.financial_accounts (id, account_number, type, owner_id)
       VALUES ($1, 'e2e-bank', 'BANK_ACCOUNT', $2)`,
      [accountId, ownerId],
    );
    await client.query(
      `INSERT INTO accounter_schema.financial_bank_accounts (id, bank_number, branch_number, owner_id)
       VALUES ($1, 12, 600, $2)`,
      [accountId, ownerId],
    );

    const tagIds = new Map<string, string>();
    for (const group of CHARGE_GROUPS) {
      await seedGroup(client, ownerId, accountId, tagIds, group);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  assertE2eDatabase();
  const started = Date.now();
  await recreateDatabase();
  await migrate();
  await seed();
  const charges = CHARGE_GROUPS.reduce((sum, group) => sum + group.descriptions.length, 0);
  // eslint-disable-next-line no-console
  console.log(
    `[e2e] Seeded ${e2eDatabase.database} with ${charges} charges in ${Date.now() - started} ms`,
  );
}

main().catch(error => {
  // eslint-disable-next-line no-console
  console.error('[e2e] Seeding failed:', error);
  process.exit(1);
});
