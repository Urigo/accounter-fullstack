import { config } from 'dotenv';
import pg from 'pg';
import {
  assertLocalDatabase,
  assertOptInsNotInEnvFile,
  describeDatabaseTarget,
  type DatabaseTarget,
} from '../packages/migrations/src/local-db-guard.js';
import { seedAdminCore } from '../packages/server/scripts/seed-admin-context.js';
import { insertFixture } from '../packages/server/src/__tests__/helpers/fixture-loader.js';
import type {
  Fixture,
  FixtureAccountTaxCategories,
} from '../packages/server/src/__tests__/helpers/fixture-types.js';
import { assertOptInsNotInTestEnvFiles } from '../packages/server/src/__tests__/helpers/test-db-config.js';
import { makeUUID } from '../packages/server/src/demo-fixtures/helpers/deterministic-uuid.js';
import { resolveAdminPlaceholders } from '../packages/server/src/demo-fixtures/helpers/placeholder.js';
import { seedDemoUsers } from '../packages/server/src/demo-fixtures/helpers/seed-demo-users.js';
import { seedExchangeRates } from '../packages/server/src/demo-fixtures/helpers/seed-exchange-rates.js';
import { seedVATDefault } from '../packages/server/src/demo-fixtures/helpers/seed-vat.js';
import { getAllUseCases } from '../packages/server/src/demo-fixtures/use-cases/index.js';
import type { FixtureSpec } from '../packages/server/src/fixtures/fixture-spec.js';
import { seedCountries } from '../packages/server/src/modules/countries/helpers/seed-countries.helper.js';
import {
  assertDemoSeedTarget,
  DemoSeedRefusedError,
  resetDemoSeedTables,
} from './demo-seed-guard.js';

const loadedEnv = config();

/**
 * Custom error class for demo seeding failures
 * Preserves stack trace and provides context for debugging
 */
class DemoSeedError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DemoSeedError';
    // Preserve original stack if available
    if (cause instanceof Error && cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

/**
 * Convert use-case fixtures to the format expected by insertFixture
 *
 * This function bridges the semantic use-case fixture format (optimized for
 * demo data authoring) and the test fixture format (optimized for database
 * insertion). The conversion handles:
 *
 * - Field name mapping (e.g., ownerId → owner_id, canSettleWithReceipt → isReceiptEnough)
 * - Nested structure flattening (e.g., taxCategoryMappings array)
 * - Type conversions (string → number for amounts)
 * - Default value injection for NOT NULL database columns
 *
 * @param useCaseFixtures - Use-case format fixtures from registry
 * @returns Fixture object ready for insertFixture() helper
 *
 * @example
 * ```typescript
 * const useCase = getAllUseCases()[0];
 * const testFixture = convertUseCaseFixtureToFixture(useCase.fixtures);
 * await insertFixture(client, testFixture);
 * ```
 *
 * @remarks
 * - Admin business is NOT included by default; caller must inject it
 * - Account numbers are used for account_id references (resolved by fixture-loader)
 * - All optional fields receive safe defaults to satisfy database constraints
 */
function convertUseCaseFixtureToFixture(useCaseFixtures: FixtureSpec): Fixture {
  const fixture: Fixture = {};

  if (useCaseFixtures.businesses && useCaseFixtures.businesses.length > 0) {
    fixture.businesses = {
      businesses: useCaseFixtures.businesses.map(b => ({
        id: b.id,
        name: b.name || b.id,
        hebrewName: b.name,
        country: b.country,
        isReceiptEnough: b.canSettleWithReceipt,
        isDocumentsOptional: false,
        exemptDealer: false,
        optionalVat: false,
        address: null,
        email: null,
        website: null,
        phoneNumber: null,
        governmentId: null,
        suggestions: null,
        pcn874RecordTypeOverride: null,
        ownerId: b.ownerId,
      })),
    };
  }

  if (useCaseFixtures.taxCategories && useCaseFixtures.taxCategories.length > 0) {
    fixture.taxCategories = {
      taxCategories: useCaseFixtures.taxCategories.map(tc => ({
        id: tc.id,
        name: tc.name,
        hashavshevetName: null,
        taxExcluded: false,
        ownerId: tc.ownerId,
      })),
    };
  }

  if (useCaseFixtures.financialAccounts && useCaseFixtures.financialAccounts.length > 0) {
    fixture.accounts = {
      accounts: useCaseFixtures.financialAccounts.map(fa => ({
        accountNumber: fa.accountNumber,
        type: fa.type,
        privateBusiness: 'Private',
        ownerId: fa.ownerId,
      })),
    };

    const mappings: FixtureAccountTaxCategories['mappings'] =
      useCaseFixtures.financialAccounts.flatMap(fa =>
        (fa.taxCategoryMappings || []).map(tcm => ({
          accountNumber: fa.accountNumber,
          currency: tcm.currency,
          taxCategoryId: tcm.taxCategoryId,
          ownerId: tcm.ownerId,
        })),
      );

    if (mappings.length > 0) {
      fixture.accountTaxCategories = { mappings };
    }
  }

  if (useCaseFixtures.charges && useCaseFixtures.charges.length > 0) {
    fixture.charges = {
      charges: useCaseFixtures.charges.map(c => ({
        id: c.id,
        owner_id: c.ownerId,
        user_description: c.userDescription,
        is_property: false,
        type: null,
        optional_vat: false,
        accountant_status: 'PENDING',
        documents_optional_flag: false,
        tax_category_id: null,
      })),
    };
  }

  if (useCaseFixtures.transactions && useCaseFixtures.transactions.length > 0) {
    fixture.transactions = {
      transactions: useCaseFixtures.transactions.map(t => ({
        id: t.id,
        charge_id: t.chargeId,
        business_id: t.businessId,
        account_id: t.accountNumber, // Will be resolved to UUID by fixture-loader
        amount: t.amount,
        currency: t.currency,
        event_date: t.eventDate,
        debit_date: t.debitDate,
        source_id: 'DEMO_SEED',
        owner_id: t.ownerId,
      })),
    };
  }

  if (useCaseFixtures.documents && useCaseFixtures.documents.length > 0) {
    fixture.documents = {
      documents: useCaseFixtures.documents.map(d => ({
        id: d.id,
        charge_id: d.chargeId,
        creditor_id: d.creditorId,
        debtor_id: d.debtorId,
        serial_number: d.serialNumber,
        type: d.type,
        date: d.date,
        total_amount: Number(d.totalAmount),
        currency_code: d.currencyCode,
        owner_id: d.ownerId,
      })),
    };
  }

  return fixture;
}

/**
 * Run a guard that lives in another module. What it throws is a refusal, so hand it on as one:
 * the handler at the bottom of this file prints a refusal once, as a message without a stack.
 */
function refusing(guard: () => void): void {
  try {
    guard();
  } catch (error) {
    throw new DemoSeedRefusedError(error instanceof Error ? error.message : String(error));
  }
}

async function seedDemoData() {
  // 1. Guard checks. Each refusal is thrown and printed once, at the bottom of this file.
  //
  // First, before any gate below reads its opt-in: `config()` above has already copied .env
  // into process.env, so an ALLOW_DEMO_SEED or ALLOW_REMOTE_DB left in that file would satisfy
  // those gates for every run without anyone typing it.
  refusing(() => assertOptInsNotInEnvFile(loadedEnv.parsed, '.env'));
  // The same for the files test-db-config.ts loaded: it is imported (via fixture-loader) before
  // the `config()` above runs, and it also loads ../../.env, which that call never parses.
  refusing(() => assertOptInsNotInTestEnvFiles());

  if (process.env.NODE_ENV === 'production') {
    throw new DemoSeedRefusedError('Refusing to seed demo data in production environment');
  }

  if (process.env.ALLOW_DEMO_SEED !== '1') {
    throw new DemoSeedRefusedError('ALLOW_DEMO_SEED=1 required to run demo seed');
  }

  // Neither gate above says anything about *which* database POSTGRES_* points at, and both
  // can be satisfied without anyone meaning to seed: vitest sets NODE_ENV=test, and the
  // demo-seed E2E used to set ALLOW_DEMO_SEED=1 itself.
  //
  // So a non-local target is refused unless the command opts in with ALLOW_REMOTE_DB=1. The
  // staging deploy, which seeds a deployed database on purpose, sets it in its build command
  // (packages/server/docs/demo-staging-guide.md). A new staging or preview environment failing
  // its first deploy here is the intended cost -- a deploy that fails is recoverable; a
  // database that was truncated is not.
  refusing(() =>
    assertLocalDatabase(
      {
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        db: process.env.POSTGRES_DB,
        user: process.env.POSTGRES_USER,
      },
      'the demo data seed',
    ),
  );

  const client = new pg.Client({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL === '1',
  });

  // Constructing the client opens nothing. The target is read back from it rather than from
  // POSTGRES_* on purpose: node-postgres fills an unset host or database from PGHOST /
  // PGDATABASE and its own defaults, and the checks below have to judge the database this
  // client will actually reach.
  const target: DatabaseTarget = {
    host: client.host,
    port: client.port,
    db: client.database,
    user: client.user,
  };

  // The gates above settle whether the seed may run and whether it may leave this machine.
  // None of them says which database it is about to empty: with both opt-ins on the command,
  // as the staging deploy has them, every POSTGRES_* target gets this far, a production one
  // included. And a local host is no better a clue, since a copy of production restored for
  // measuring sits on localhost too.
  //
  // So refuse a database that is not a demo database, before any connection is opened. The rule
  // (scripts/demo-seed-guard.ts) is on the database name: a name that says production is
  // refused whatever is set, a name that says staging, demo, test or preview passes, and any
  // other database has to be confirmed by its exact name for this one command.
  const verdict = assertDemoSeedTarget(target, process.env);
  console.log(`✅ Demo seed target: ${describeDatabaseTarget(target)} (${verdict.because})`);

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // 1.5. Pin the session to the admin tenant before touching any domain table.
    //
    // Every table this script writes is `FORCE ROW LEVEL SECURITY`, and
    // `accounter_schema.get_current_business_id()` RAISES rather than returning NULL when
    // `app.current_business_id` is unset -- so with no context every insert aborts with
    // P0001. Locally that never surfaces: dev and CI connect as the `postgres` superuser,
    // which bypasses RLS regardless of FORCE. A deployed run connects as a non-superuser
    // and does not.
    //
    // The admin id is derived the same way `seedAdminCore` derives it, so the context can be
    // established before the row it names exists -- that is what the `allow_bootstrap_root`
    // policy (`id = get_current_business_id()`) is for. Every subsequent row is owned by this
    // same business, so one context covers the whole seed.
    //
    // Session-level (is_local = false) is required: steps 2-4 below run outside any
    // transaction, and a transaction-local setting would be gone by the next statement.
    const expectedAdminBusinessId = makeUUID('business', 'Admin Business');
    await client.query(`SELECT set_config('app.current_business_id', $1, false)`, [
      expectedAdminBusinessId,
    ]);

    // Prove the context took *before* the destructive reset below. That TRUNCATE is
    // autocommitted, so discovering a context problem after it would leave the environment
    // wiped rather than merely un-reseeded.
    await client.query(`SELECT accounter_schema.get_current_business_id()`);

    // 2. Destructive reset (domain tables only; preserve schema/migrations/countries).
    //
    // The TRUNCATE itself is in resetDemoSeedTables, which first asks the server which database
    // this connection is on and applies the same rule to that name. Do not issue a TRUNCATE
    // from this file: that function is the only path to one.
    console.log('🧹 Clearing existing demo data...');
    await resetDemoSeedTables(client, target, process.env);
    console.log('✅ Domain tables cleared');

    // 3. Seed foundation data
    console.log('✅ Seeding countries...');
    await seedCountries(client);

    console.log('✅ Seeding FIAT exchange rates...');
    await seedExchangeRates(client);

    console.log('✅ Seeding VAT defaults...');
    await seedVATDefault(client);

    // 4. Create admin business context
    console.log('✅ Creating admin business context...');
    const { adminEntityId: adminBusinessId } = await seedAdminCore(client);
    if (adminBusinessId !== expectedAdminBusinessId) {
      // The RLS context above was pinned to the derived id. If seedAdminCore ever returns a
      // different one, every write after this point is silently outside the policy.
      throw new DemoSeedError(
        `Admin business id mismatch: RLS context is pinned to ${expectedAdminBusinessId} but ` +
          `seedAdminCore returned ${adminBusinessId}`,
      );
    }
    await client.query(
      `INSERT INTO accounter_schema.businesses_admin (id, owner_id)
       VALUES ($1, $1)
       ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id`,
      [adminBusinessId],
    );
    console.log(`✅ Admin Business ID: ${adminBusinessId}`);

    const { adminUserId, accountantUserId } = await seedDemoUsers(client, adminBusinessId);
    console.log(
      `✅ Demo users seeded for local dev bypass. Copy to packages/client/.env: DEV_AUTH_USER_ID=${adminUserId} (admin) or ${accountantUserId} (accountant)`,
    );
    console.log(`   adminUserId=${adminUserId}, accountantUserId=${accountantUserId}`);

    // 5. Load all use-cases
    const useCases = getAllUseCases();
    console.log(`📦 Loading ${useCases.length} use-cases...`);

    // Begin transaction for fixture insertion
    await client.query('BEGIN');
    try {
      for (const useCase of useCases) {
        console.log(`📦 ${useCase.name} (${useCase.id})`);
        const resolvedUseCaseFixtures = resolveAdminPlaceholders(useCase.fixtures, adminBusinessId);
        const fixture = convertUseCaseFixtureToFixture(resolvedUseCaseFixtures);

        // Inject admin business into every fixture to satisfy foreign key constraints
        // (charges.owner_id, documents.creditor_id/debtor_id may reference admin business)
        fixture.businesses ||= {
          businesses: [],
        };

        // Check if admin business is already in the list (avoid duplicate insertions)
        // Some use-cases may define admin explicitly; most rely on injection here
        const adminExists = fixture.businesses.businesses.some(b => b.id === adminBusinessId);
        if (!adminExists) {
          fixture.businesses.businesses.push({
            id: adminBusinessId,
            name: 'Accounter Admin Business',
            country: 'ISR',
            isReceiptEnough: false,
            isDocumentsOptional: false,
            exemptDealer: false,
            optionalVat: false,
            address: null,
            email: null,
            website: null,
            phoneNumber: null,
            governmentId: null,
            suggestions: null,
            pcn874RecordTypeOverride: null,
            ownerId: adminBusinessId,
          });
        }

        await insertFixture(client, fixture, adminBusinessId);
      }
      await client.query('COMMIT');
      console.log('✅ All use-cases seeded successfully');
    } catch (fixtureError) {
      await client.query('ROLLBACK');
      throw new DemoSeedError('Fixture insertion failed', fixtureError);
    }

    console.log('✅ Demo data seed complete');
  } catch (error) {
    if (error instanceof DemoSeedRefusedError) {
      // The reset refused the connected database. Nothing was changed and nothing failed, so
      // let it reach the handler below as the refusal it is instead of as a wrapped crash.
      throw error;
    }
    console.error('❌ Seed failed:');
    if (error instanceof DemoSeedError) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    } else if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }
    throw new DemoSeedError('Demo data seed failed', error);
  } finally {
    await client.end();
  }
}

/**
 * The run. It starts when this file is loaded, as it always has; the promise is exported only
 * so `scripts/__tests__/seed-demo-data.test.ts` can wait for it to finish.
 */
export const demoSeedRun = seedDemoData().catch(error => {
  if (error instanceof DemoSeedRefusedError) {
    // A refusal is an answer, not a crash: print the message and leave out the stack trace.
    console.error(`❌ ${error.message}`);
  } else {
    console.error('❌ Fatal seed error');
    console.error('Error object:', error);
    console.error('Error type:', typeof error);
    if (error instanceof DemoSeedError) {
      console.error('Stack:', error.stack);
    } else if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }
  }
  process.exit(1);
});
