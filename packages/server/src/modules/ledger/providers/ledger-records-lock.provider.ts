import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type { ILockLedgerRecordsUpToQuery } from '../types.js';

// Flags a business's reported records. Flagged records stay locked even if the
// ledger lock date is later moved back: reopening a period allows new entries in
// it, never changes to records that were already reported.
const lockLedgerRecordsUpTo = sql<ILockLedgerRecordsUpToQuery>`
  UPDATE accounter_schema.ledger_records
  SET locked = TRUE
  WHERE owner_id = $ownerId!
    AND locked IS NOT TRUE
    AND (invoice_date <= $date! OR value_date <= $date!);
`;

type QueryExecutor = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
};

/**
 * The per-record half of the ledger lock (the other half is the admin-context
 * `ledger_lock` date). Kept apart from `LedgerProvider` so `AdminContextProvider`
 * can run it inside its lock transaction without a DI cycle.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class LedgerRecordsLockProvider {
  constructor(private db: TenantAwareDBClient) {}

  /** Sets `locked = TRUE` on the owner's records dated on or before `date`. */
  public async lockRecordsUpTo(
    { ownerId, date }: { ownerId: string; date: TimelessDateString },
    executor?: QueryExecutor,
  ): Promise<void> {
    await lockLedgerRecordsUpTo.run({ ownerId, date }, executor ?? this.db);
  }
}
