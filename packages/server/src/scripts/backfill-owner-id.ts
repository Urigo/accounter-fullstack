import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../environment.js';
import { DBProvider } from '../modules/app-providers/db.provider.js';

const { Pool } = pg;

type BackfillConfig = {
  table: string;
  updateLogic: string;
  dependsOn?: string[];
  idColumn?: string | string[];
};

/*
  Backfill Rules from Spec 3.2.2.
*/
const DEFAULT_ADMIN_ID = `'${env.authorization.adminBusinessId}'`;

const configs: BackfillConfig[] = [
  // --- Standard Charge Links ---
  {
    table: 'accounter_schema.business_trip_charges',
    updateLogic: `(SELECT c.owner_id FROM accounter_schema.charges c WHERE c.id = t.charge_id)`,
    idColumn: 'charge_id',
  },
  {
    table: 'accounter_schema.charge_balance_cancellation',
    updateLogic: `(SELECT c.owner_id FROM accounter_schema.charges c WHERE c.id = t.charge_id)`,
    idColumn: 'charge_id',
  },
  {
    table: 'accounter_schema.charge_spread',
    updateLogic: `(SELECT c.owner_id FROM accounter_schema.charges c WHERE c.id = t.charge_id)`,
    idColumn: 'charge_id',
  },
  {
    table: 'accounter_schema.charge_tags',
    updateLogic: `(SELECT c.owner_id FROM accounter_schema.charges c WHERE c.id = t.charge_id)`,
    idColumn: ['charge_id', 'tag_id'],
  },
  {
    table: 'accounter_schema.charge_unbalanced_ledger_businesses',
    updateLogic: `(SELECT c.owner_id FROM accounter_schema.charges c WHERE c.id = t.charge_id)`,
    idColumn: 'charge_id',
  },
  {
    table: 'accounter_schema.charges_bank_deposits',
    updateLogic: `(SELECT c.owner_id FROM accounter_schema.charges c WHERE c.id = t.id)`,
    idColumn: 'id',
  },
  {
    table: 'accounter_schema.depreciation',
    updateLogic: `(SELECT c.owner_id FROM accounter_schema.charges c WHERE c.id = t.charge_id)`,
    idColumn: 'charge_id',
  },
  {
    table: 'accounter_schema.documents',
    updateLogic: `(SELECT c.owner_id FROM accounter_schema.charges c WHERE c.id = t.charge_id)`,
  },
  {
    table: 'accounter_schema.misc_expenses',
    updateLogic: `(SELECT c.owner_id FROM accounter_schema.charges c WHERE c.id = t.charge_id)`,
    idColumn: 'charge_id',
  },
  {
    table: 'accounter_schema.transactions',
    updateLogic: `(SELECT c.owner_id FROM accounter_schema.charges c WHERE c.id = t.charge_id)`,
  },

  // --- Financial Entity / Business Links ---
  {
    table: 'accounter_schema.businesses',
    updateLogic: `(SELECT fe.owner_id FROM accounter_schema.financial_entities fe WHERE fe.id = t.id)`,
  },
  {
    table: 'accounter_schema.businesses_admin',
    updateLogic: `(SELECT fe.owner_id FROM accounter_schema.financial_entities fe WHERE fe.id = (SELECT b.id FROM accounter_schema.businesses b WHERE b.id = t.id))`,
  },
  {
    table: 'accounter_schema.corporate_tax_variables',
    updateLogic: `(SELECT fe.owner_id FROM accounter_schema.financial_entities fe WHERE fe.id = t.corporate_id)`,
    idColumn: ['corporate_id', 'date'],
  },
  {
    table: 'accounter_schema.employees',
    updateLogic: `(SELECT fe.owner_id FROM accounter_schema.financial_entities fe WHERE fe.id = t.business_id)`,
    idColumn: 'business_id',
  },
  {
    table: 'accounter_schema.salaries',
    updateLogic: `(SELECT fe.owner_id FROM accounter_schema.financial_entities fe WHERE fe.id = t.employer)`,
    idColumn: ['month', 'employee_id'],
  },
  {
    table: 'accounter_schema.pcn874',
    updateLogic: `(SELECT fe.owner_id FROM accounter_schema.financial_entities fe WHERE fe.id = t.business_id)`,
    idColumn: ['business_id', 'month_date'],
  },
  {
    table: 'accounter_schema.clients',
    updateLogic: `(SELECT fe.owner_id FROM accounter_schema.financial_entities fe WHERE fe.id = t.business_id)`,
    idColumn: 'business_id',
  },
  {
    table: 'accounter_schema.deel_workers',
    updateLogic: `(SELECT fe.owner_id FROM accounter_schema.financial_entities fe WHERE fe.id = t.business_id)`,
    idColumn: 'business_id',
  },

  // --- Dependent Links ---
  {
    table: 'accounter_schema.documents_issued',
    dependsOn: ['accounter_schema.documents'],
    updateLogic: `(SELECT d.owner_id FROM accounter_schema.documents d WHERE d.id = t.id)`,
  },
  {
    table: 'accounter_schema.deel_invoices',
    dependsOn: ['accounter_schema.documents'],
    updateLogic: `(SELECT d.owner_id FROM accounter_schema.documents d WHERE d.id = t.document_id)`,
  },

  // --- Financial Accounts ---
  {
    table: 'accounter_schema.financial_accounts',
    updateLogic: 't.owner',
  },
  {
    table: 'accounter_schema.financial_accounts_tax_categories',
    dependsOn: ['accounter_schema.financial_accounts'],
    updateLogic: `(SELECT fa.owner_id FROM accounter_schema.financial_accounts fa WHERE fa.id = t.financial_account_id)`,
    idColumn: ['financial_account_id', 'currency'],
  },
  {
    table: 'accounter_schema.financial_bank_accounts',
    dependsOn: ['accounter_schema.financial_accounts'],
    updateLogic: `(SELECT fa.owner_id FROM accounter_schema.financial_accounts fa WHERE fa.id = t.id)`,
  },

  // --- Business Trips (Complex) ---
  {
    table: 'accounter_schema.business_trips',
    updateLogic: `(
      SELECT c.owner_id 
      FROM accounter_schema.business_trips_transactions btt
      JOIN accounter_schema.business_trips_transactions_match bttm ON bttm.business_trip_transaction_id = btt.id
      JOIN accounter_schema.transactions tr ON tr.id = bttm.transaction_id
      JOIN accounter_schema.charges c ON c.id = tr.charge_id
      WHERE btt.business_trip_id = t.id
      LIMIT 1
    )`,
  },

  {
    table: 'accounter_schema.business_trips_attendees',
    dependsOn: ['accounter_schema.business_trips'],
    updateLogic: `(SELECT bt.owner_id FROM accounter_schema.business_trips bt WHERE bt.id = t.business_trip_id)`,
    idColumn: ['business_trip_id', 'attendee_business_id'],
  },
  {
    table: 'accounter_schema.business_trips_transactions',
    dependsOn: ['accounter_schema.business_trips'],
    updateLogic: `(SELECT bt.owner_id FROM accounter_schema.business_trips bt WHERE bt.id = t.business_trip_id)`,
  },

  {
    table: 'accounter_schema.business_trips_employee_payments',
    dependsOn: ['accounter_schema.business_trips_transactions'],
    updateLogic: `(SELECT btt.owner_id FROM accounter_schema.business_trips_transactions btt WHERE btt.id = t.id)`,
  },
  {
    table: 'accounter_schema.business_trips_transactions_accommodations',
    dependsOn: ['accounter_schema.business_trips_transactions'],
    updateLogic: `(SELECT btt.owner_id FROM accounter_schema.business_trips_transactions btt WHERE btt.id = t.id)`,
  },
  {
    table: 'accounter_schema.business_trips_transactions_car_rental',
    dependsOn: ['accounter_schema.business_trips_transactions'],
    updateLogic: `(SELECT btt.owner_id FROM accounter_schema.business_trips_transactions btt WHERE btt.id = t.id)`,
  },
  {
    table: 'accounter_schema.business_trips_transactions_flights',
    dependsOn: ['accounter_schema.business_trips_transactions'],
    updateLogic: `(SELECT btt.owner_id FROM accounter_schema.business_trips_transactions btt WHERE btt.id = t.id)`,
  },
  {
    table: 'accounter_schema.business_trips_transactions_match',
    dependsOn: ['accounter_schema.business_trips_transactions'],
    updateLogic: `(SELECT btt.owner_id FROM accounter_schema.business_trips_transactions btt WHERE btt.id = t.business_trip_transaction_id)`,
    idColumn: ['business_trip_transaction_id', 'transaction_id'],
  },
  {
    table: 'accounter_schema.business_trips_transactions_other',
    dependsOn: ['accounter_schema.business_trips_transactions'],
    updateLogic: `(SELECT btt.owner_id FROM accounter_schema.business_trips_transactions btt WHERE btt.id = t.id)`,
  },
  {
    table: 'accounter_schema.business_trips_transactions_tns',
    dependsOn: ['accounter_schema.business_trips_transactions'],
    updateLogic: `(SELECT btt.owner_id FROM accounter_schema.business_trips_transactions btt WHERE btt.id = t.id)`,
  },

  // --- Other ---
  {
    table: 'accounter_schema.tax_categories',
    updateLogic: `(SELECT fe.owner_id FROM accounter_schema.financial_entities fe WHERE fe.id = t.id)`,
  },
  {
    table: 'accounter_schema.clients_contracts',
    updateLogic: `(SELECT fe.owner_id FROM accounter_schema.financial_entities fe WHERE fe.id = t.client_id)`,
  },

  // --- General Catch-All for Any Remaining Tables with owner_id Directly ---

  {
    table: 'accounter_schema.pension_funds',
    updateLogic: DEFAULT_ADMIN_ID,
  },
  {
    table: 'accounter_schema.sort_codes',
    updateLogic: DEFAULT_ADMIN_ID,
    idColumn: 'key',
  },
  {
    table: 'accounter_schema.tags',
    updateLogic: DEFAULT_ADMIN_ID,
  },
];

const BATCH_SIZE = 10_000;
const SLEEP_MS = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function backfillOwnerId(db: DBProvider) {
  console.log('Starting backfill-owner-id process...');

  try {
    const isHealthy = await db.healthCheck();
    if (!isHealthy) {
      throw new Error('Database is not healthy');
    }
    console.log('Database connected.');

    for (const config of configs) {
      console.log(`Processing table: ${config.table}`);

      if (config.dependsOn?.length) {
        let dependenciesMet = true;
        for (const depTable of config.dependsOn) {
          const depCountRes = await db.pool.query(
            `SELECT COUNT(*) as count FROM ${depTable} WHERE owner_id IS NULL`,
          );
          const depCount = parseInt(depCountRes.rows[0].count, 10);
          if (depCount > 0) {
            console.warn(
              `  Skipping ${config.table} because dependency ${depTable} still has ${depCount} NULLs.`,
            );
            dependenciesMet = false;
            break;
          }
        }
        if (!dependenciesMet) {
          continue;
        }
      }

      // Initial count check
      const initialCountRes = await db.pool.query(
        `SELECT COUNT(*) as count FROM ${config.table} WHERE owner_id IS NULL`,
      );
      const initialCount = parseInt(initialCountRes.rows[0].count, 10);
      console.log(`  Initial NULLs: ${initialCount}`);

      if (initialCount === 0) {
        console.log(`  Skipping (0 NULLs).`);
        continue;
      }

      let processed = 0;
      let hasMore = true;

      while (hasMore) {
        // Find batch of IDs to update
        // We select IDs where owner_id IS NULL

        const idCol = config.idColumn || 'id';
        const selectCols = Array.isArray(idCol) ? idCol.join(', ') : idCol;
        const whereClause = Array.isArray(idCol)
          ? idCol.map(col => `t.${col} = b.${col}`).join(' AND ')
          : `t.${idCol} = b.${idCol}`;

        // Construct the update query dynamically
        const updateQuery = `
          WITH batch AS (
             SELECT ${selectCols} 
             FROM ${config.table} 
             WHERE owner_id IS NULL 
             LIMIT ${BATCH_SIZE}
             FOR UPDATE SKIP LOCKED
          )
          UPDATE ${config.table} t
          SET owner_id = ${config.updateLogic}
          FROM batch b
          WHERE ${whereClause}
          RETURNING t.owner_id;
        `;

        const result = await db.pool.query(updateQuery);
        const batchCount = result.rowCount;
        processed += batchCount ?? 0;

        if (batchCount === 0) {
          hasMore = false;
        } else {
          console.log(`  Updated ${batchCount} rows...`);

          // Check for unresolvable rows (owner_id became NULL)
          const nulls = result.rows.filter(
            (r: unknown) => (r as { owner_id: unknown }).owner_id === null,
          );
          if (nulls.length === batchCount && batchCount > 0) {
            console.warn(
              `  Warning: All ${batchCount} rows in batch updated to NULL (logic failed to resolve). Breaking loop for this table.`,
            );
            hasMore = false;
          } else if (nulls.length > 0) {
            console.warn(`  Warning: ${nulls.length} rows updated to NULL.`);
          }

          if (hasMore) {
            await sleep(SLEEP_MS);
          }
        }
      }

      const remainingResult = await db.pool.query(
        `SELECT COUNT(*) as count FROM ${config.table} WHERE owner_id IS NULL`,
      );
      const remaining = parseInt(remainingResult.rows[0].count, 10);
      console.log(
        `Finished ${config.table}. Total updated in this run: ${processed}. Remaining NULLs: ${remaining} (quarantined/unresolvable).`,
      );
    }

    console.log('Backfill complete.');
  } catch (error) {
    console.error('Backfill failed:', error);
    throw error;
  }
}

// Entry point execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    const pool = new Pool({
      user: env.postgres.user,
      password: env.postgres.password,
      host: env.postgres.host,
      port: Number(env.postgres.port),
      database: env.postgres.db,
      ssl: env.postgres.ssl ? { rejectUnauthorized: false } : false,
      max: 5,
    });

    const db = new DBProvider(pool);
    try {
      await backfillOwnerId(db);
    } catch (e) {
      console.error('Fatal error during backfill:', e);
      process.exit(1);
    } finally {
      await db.shutdown();
    }
  })();
}
