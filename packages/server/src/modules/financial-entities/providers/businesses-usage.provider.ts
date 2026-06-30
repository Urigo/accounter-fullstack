import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetDocumentsCountByBusinessIdsQuery,
  IGetLedgerRecordsCountByBusinessIdsQuery,
  IGetMiscExpensesCountByBusinessIdsQuery,
  IGetTransactionsCountByBusinessIdsQuery,
} from '../types.js';

export type BusinessUsageCounts = {
  transactions: number;
  documents: number;
  miscExpenses: number;
  ledgerRecords: number;
};

// Cap the number of ids bound per query. The ledger query references the id array four
// times, so each chunk binds up to 4 * CHUNK_SIZE parameters — kept well under Postgres'
// 65,535 parameter limit.
const CHUNK_SIZE = 1000;

const getTransactionsCountByBusinessIds = sql<IGetTransactionsCountByBusinessIdsQuery>`
  SELECT business_id, COUNT(*) AS count
  FROM accounter_schema.transactions
  WHERE business_id IN $$businessIds
  GROUP BY business_id;`;

// A business may be referenced as either the debtor or the creditor of a document, so
// the two columns are unioned into a single business_id projection before grouping. A
// document that references the same business on both sides is therefore counted twice
// (once per side); this is acceptable for a usage indicator.
const getDocumentsCountByBusinessIds = sql<IGetDocumentsCountByBusinessIdsQuery>`
  SELECT business_id, COUNT(*) AS count
  FROM (
    SELECT debtor_id AS business_id
    FROM accounter_schema.documents
    WHERE debtor_id IN $$businessIds
    UNION ALL
    SELECT creditor_id AS business_id
    FROM accounter_schema.documents
    WHERE creditor_id IN $$businessIds
  ) AS documents
  GROUP BY business_id;`;

// Same debtor/creditor union as documents.
const getMiscExpensesCountByBusinessIds = sql<IGetMiscExpensesCountByBusinessIdsQuery>`
  SELECT business_id, COUNT(*) AS count
  FROM (
    SELECT debtor_id AS business_id
    FROM accounter_schema.misc_expenses
    WHERE debtor_id IN $$businessIds
    UNION ALL
    SELECT creditor_id AS business_id
    FROM accounter_schema.misc_expenses
    WHERE creditor_id IN $$businessIds
  ) AS misc_expenses
  GROUP BY business_id;`;

// A ledger record can reference a business in any of its four debit/credit entity
// columns, so all four are unioned before grouping.
const getLedgerRecordsCountByBusinessIds = sql<IGetLedgerRecordsCountByBusinessIdsQuery>`
  SELECT business_id, COUNT(*) AS count
  FROM (
    SELECT debit_entity1 AS business_id
    FROM accounter_schema.ledger_records
    WHERE debit_entity1 IN $$businessIds
    UNION ALL
    SELECT debit_entity2 AS business_id
    FROM accounter_schema.ledger_records
    WHERE debit_entity2 IN $$businessIds
    UNION ALL
    SELECT credit_entity1 AS business_id
    FROM accounter_schema.ledger_records
    WHERE credit_entity1 IN $$businessIds
    UNION ALL
    SELECT credit_entity2 AS business_id
    FROM accounter_schema.ledger_records
    WHERE credit_entity2 IN $$businessIds
  ) AS ledger_records
  GROUP BY business_id;`;

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

    const apply = (
      rows: { business_id: string | null; count: string | null }[],
      key: keyof BusinessUsageCounts,
    ): void => {
      for (const row of rows) {
        if (!row.business_id) {
          continue;
        }
        const counts = usage.get(row.business_id);
        if (counts) {
          counts[key] = Number(row.count ?? 0);
        }
      }
    };

    // chunk the ids to stay within Postgres' bind-parameter limit (see CHUNK_SIZE)
    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
      const [transactions, documents, miscExpenses, ledgerRecords] = await Promise.all([
        getTransactionsCountByBusinessIds.run({ businessIds: chunk }, this.db),
        getDocumentsCountByBusinessIds.run({ businessIds: chunk }, this.db),
        getMiscExpensesCountByBusinessIds.run({ businessIds: chunk }, this.db),
        getLedgerRecordsCountByBusinessIds.run({ businessIds: chunk }, this.db),
      ]);

      apply(transactions, 'transactions');
      apply(documents, 'documents');
      apply(miscExpenses, 'miscExpenses');
      apply(ledgerRecords, 'ledgerRecords');
    }

    return usage;
  }
}
