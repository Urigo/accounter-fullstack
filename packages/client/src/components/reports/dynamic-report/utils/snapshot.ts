import type { DynamicReportSnapshotInput } from '../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../helpers/dates.js';

/** The shape `businessTransactionsSumFromLedgerRecords` returns, narrowed to what a snapshot needs. */
type BusinessSumLike = {
  business: { id: string };
  total: { raw: number };
};

/**
 * Captures the figures the report is showing right now, to be stored as the baseline a later visit
 * diffs against.
 *
 * Every entity with ledger activity is included, not just the ones placed in the report: an entity
 * absent from the baseline entirely is how a later visit recognises it as new, and an unplaced
 * entity that gets dragged in afterwards should not read as new.
 *
 * Values carry the same sign flip the leaves render with, so the snapshot holds what was on screen.
 */
export function buildSnapshotInput(params: {
  businessSums: BusinessSumLike[];
  fromDate: TimelessDateString;
  toDate: TimelessDateString;
  scopeOwnerId: string;
}): DynamicReportSnapshotInput {
  return {
    fromDate: params.fromDate,
    toDate: params.toDate,
    scopeOwnerId: params.scopeOwnerId,
    values: params.businessSums.map(sum => ({
      entityId: sum.business.id,
      value: sum.total.raw * -1,
    })),
  };
}
