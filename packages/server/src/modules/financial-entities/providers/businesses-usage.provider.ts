import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type { IGetUsageCountsByBusinessIdsQuery } from '../types.js';

export type BusinessUsageCounts = {
  transactions: number;
  documents: number;
  miscExpenses: number;
  ledgerRecords: number;
};

// Cap the number of ids bound per query. The combined query references the id array nine
// times (one per UNION ALL branch), so each chunk binds up to 9 * CHUNK_SIZE parameters —
// kept well under Postgres' 65,535 parameter limit.
const CHUNK_SIZE = 1000;

// Maps the `source` discriminator emitted by each UNION ALL branch to its counts key.
const SOURCE_TO_KEY: Record<string, keyof BusinessUsageCounts> = {
  transactions: 'transactions',
  documents: 'documents',
  misc_expenses: 'miscExpenses',
  ledger: 'ledgerRecords',
};

// A single statement that counts, per business id, how often the business is referenced
// across each source. Every id-bearing column is projected into a common (business_id,
// source) shape via UNION ALL so a business that appears in more than one column
// (documents/misc_expenses debtor+creditor, ledger debit/credit entities) is attributed
// correctly. A row that references the same business on two columns is counted once per
// column, which is acceptable for a usage indicator. Combining all sources into one query
// matters because TenantAwareDBClient serializes queries on a single mutex-guarded
// connection, so four separate queries would be four sequential transactions.
const getUsageCountsByBusinessIds = sql<IGetUsageCountsByBusinessIdsQuery>`
  SELECT business_id, source, COUNT(*) AS count
  FROM (
    SELECT business_id, 'transactions' AS source
    FROM accounter_schema.transactions
    WHERE business_id IN $$businessIds
    UNION ALL
    SELECT debtor_id AS business_id, 'documents' AS source
    FROM accounter_schema.documents
    WHERE debtor_id IN $$businessIds
    UNION ALL
    SELECT creditor_id AS business_id, 'documents' AS source
    FROM accounter_schema.documents
    WHERE creditor_id IN $$businessIds
    UNION ALL
    SELECT debtor_id AS business_id, 'misc_expenses' AS source
    FROM accounter_schema.misc_expenses
    WHERE debtor_id IN $$businessIds
    UNION ALL
    SELECT creditor_id AS business_id, 'misc_expenses' AS source
    FROM accounter_schema.misc_expenses
    WHERE creditor_id IN $$businessIds
    UNION ALL
    SELECT debit_entity1 AS business_id, 'ledger' AS source
    FROM accounter_schema.ledger_records
    WHERE debit_entity1 IN $$businessIds
    UNION ALL
    SELECT debit_entity2 AS business_id, 'ledger' AS source
    FROM accounter_schema.ledger_records
    WHERE debit_entity2 IN $$businessIds
    UNION ALL
    SELECT credit_entity1 AS business_id, 'ledger' AS source
    FROM accounter_schema.ledger_records
    WHERE credit_entity1 IN $$businessIds
    UNION ALL
    SELECT credit_entity2 AS business_id, 'ledger' AS source
    FROM accounter_schema.ledger_records
    WHERE credit_entity2 IN $$businessIds
  ) AS usage
  GROUP BY business_id, source;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BusinessUsageProvider {
  constructor(private db: TenantAwareDBClient) {}

  public async getUsageByBusinessIds(
    ids: readonly string[],
  ): Promise<Map<string, BusinessUsageCounts>> {
    const usage = new Map<string, BusinessUsageCounts>();
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return usage;
    }

    // default every requested id to zero so unused businesses are represented
    for (const id of uniqueIds) {
      usage.set(id, { transactions: 0, documents: 0, miscExpenses: 0, ledgerRecords: 0 });
    }

    // chunk the ids to stay within Postgres' bind-parameter limit (see CHUNK_SIZE)
    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
      const rows = await getUsageCountsByBusinessIds.run({ businessIds: chunk }, this.db);

      for (const row of rows) {
        if (!row.business_id || !row.source) {
          continue;
        }
        const key = SOURCE_TO_KEY[row.source];
        const counts = usage.get(row.business_id);
        if (key && counts) {
          counts[key] = Number(row.count ?? 0);
        }
      }
    }

    return usage;
  }
}
