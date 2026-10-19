import type { McpChargeEmptinessQuery, McpDeleteChargeMutation } from '../gql/index.js';
import type { ToolExecutionContext } from './registry.js';

/**
 * Delete charges that a move left with nothing in them.
 *
 * Upstream `updateTransactions` and `updateDocument` delete an emptied former
 * charge only on the EMPTY_UUID "unlink" path. Moving a row onto a *real*
 * charge — the review workflow's main case: a receipt that OCR landed in its own
 * charge is attached to the charge holding the card row — leaves the former
 * charge behind with no transactions and no documents, and it keeps showing up
 * in the missing-information views. The write tools therefore note the former
 * charge ids before the move and, after it, delete the ones that are now empty.
 *
 * Deletion goes through upstream `deleteCharge`, which itself refuses a charge
 * that still has transactions or documents, so this cannot take anything with
 * it: the emptiness read is what decides, the upstream check is the backstop.
 * Misc expenses are not moved by either mutation, so a charge that still holds
 * one is kept too.
 */

export interface CleanupResult {
  /** Former charges deleted because the move left them empty. */
  deletedChargeIds: string[];
  /** Former charges kept because they still hold something. */
  keptChargeIds: string[];
  /** Deletions upstream refused, with its message; the move itself succeeded. */
  failures: Array<{ chargeId: string; message: string }>;
}

const CHARGE_EMPTINESS_QUERY = /* GraphQL */ `
  query McpChargeEmptiness($chargeIDs: [UUID!]!) {
    chargesByIDs(chargeIDs: $chargeIDs) {
      id
      metadata {
        transactionsCount
        documentsCount
        miscExpensesCount
      }
    }
  }
`;

const DELETE_CHARGE_MUTATION = /* GraphQL */ `
  mutation McpDeleteCharge($chargeId: UUID!) {
    deleteCharge(chargeId: $chargeId)
  }
`;

/**
 * Delete each of `formerChargeIds` that no longer holds a transaction, a
 * document or a misc expense. `excludeChargeId` (the target of the move) is
 * never touched even if it was also a source.
 */
export async function deleteEmptiedCharges(
  formerChargeIds: readonly string[],
  excludeChargeId: string | null,
  context: ToolExecutionContext,
): Promise<CleanupResult> {
  const result: CleanupResult = { deletedChargeIds: [], keptChargeIds: [], failures: [] };
  const candidates = [...new Set(formerChargeIds)].filter(id => id && id !== excludeChargeId);
  if (candidates.length === 0) {
    return result;
  }

  // Upstream `chargesByIDs` throws when any id is unknown — a former charge the
  // move already deleted (the EMPTY_UUID path does that itself) would fail the
  // whole read. One read per candidate keeps a vanished charge from hiding the
  // state of the others; the lists are short (one charge per moved row at most).
  const states = await Promise.all(
    candidates.map(async chargeId => {
      try {
        const data = await context.client.query<McpChargeEmptinessQuery>(
          { query: CHARGE_EMPTINESS_QUERY, variables: { chargeIDs: [chargeId] } },
          context.upstream,
        );
        return { chargeId, charge: data.chargesByIDs[0] ?? null };
      } catch {
        return { chargeId, charge: null };
      }
    }),
  );

  for (const { chargeId, charge } of states) {
    if (!charge) {
      // Already gone (or not readable): nothing to clean up, nothing to report.
      continue;
    }
    const m = charge.metadata;
    const empty =
      !!m && m.transactionsCount === 0 && m.documentsCount === 0 && m.miscExpensesCount === 0;
    if (!empty) {
      result.keptChargeIds.push(chargeId);
      continue;
    }
    try {
      const data = await context.client.mutate<McpDeleteChargeMutation>(
        { query: DELETE_CHARGE_MUTATION, variables: { chargeId } },
        context.upstream,
      );
      if (data.deleteCharge) {
        result.deletedChargeIds.push(chargeId);
      } else {
        result.failures.push({ chargeId, message: 'upstream reported the charge was not deleted' });
      }
    } catch (error) {
      result.failures.push({
        chargeId,
        message: error instanceof Error ? error.message : 'delete failed',
      });
    }
  }
  return result;
}

/** One sentence for the human summary, or an empty string when nothing happened. */
export function describeCleanup(cleanup: CleanupResult): string {
  const parts: string[] = [];
  if (cleanup.deletedChargeIds.length) {
    parts.push(
      `Deleted ${cleanup.deletedChargeIds.length} former charge(s) left empty: ${cleanup.deletedChargeIds.join(', ')}.`,
    );
  }
  if (cleanup.keptChargeIds.length) {
    parts.push(`Kept ${cleanup.keptChargeIds.length} former charge(s) that still hold something.`);
  }
  if (cleanup.failures.length) {
    parts.push(
      `Could not delete ${cleanup.failures.length} emptied charge(s): ${cleanup.failures.map(f => `${f.chargeId} (${f.message})`).join('; ')}.`,
    );
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}
