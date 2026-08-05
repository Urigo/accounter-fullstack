import { z } from 'zod';
import { ToolInputError } from './execute.js';
import type { ToolExecutionContext } from './registry.js';

/**
 * Shared business-scope input fragment.
 *
 * Every business-scoped tool takes the *same* optional `businessIds` field with
 * the *same* description, so the model learns one scoping convention instead of
 * a different one per tool. Kept in its own module so the registry never has to
 * depend on zod.
 *
 * `requestedBusinessIds()` in `execute.ts` already accepts either this array or
 * a singular `businessId`, so adding the field to a tool needs no plumbing —
 * the resolved scope flows to `x-business-scope` automatically.
 */

/** Upper bound on requested ids, matching the charges tool's original cap. */
export const MAX_REQUESTED_BUSINESS_IDS = 50;

export const businessIdsInput = z
  .array(z.string().min(1))
  .max(MAX_REQUESTED_BUSINESS_IDS)
  .optional()
  .describe(
    'Limit results to the businesses with these (owner) ids — must be a subset of the businesses you ' +
      'belong to. Omit to include all of them. Use accounter_list_business_memberships to discover ids. ' +
      'Every returned row carries its ownerId so results can be grouped by business.',
  );

/**
 * Trailing clause for the **multi-business list tools** — those taking the
 * optional {@link businessIdsInput} and returning owner-tagged rows.
 *
 * Not applicable to single-business tools: it would promise an optional
 * `businessIds` field and per-row `ownerId` that they do not have. Use
 * {@link SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX} there instead.
 */
export const SCOPE_DESCRIPTION_SUFFIX =
  'Scope: omitting `businessIds` covers every business you belong to; results are tagged with `ownerId` ' +
  'and the response echoes the effective `scope.businessIds`. If you have more than one business, call ' +
  '`accounter_list_business_memberships` first and pass explicit ids.';

/**
 * Trailing clause for tools scoped to exactly **one** business via a required
 * singular `businessId`. States only what is actually true of them: no optional
 * `businessIds`, no per-row `ownerId` (every row shares the one owner, which the
 * response reports once), but the same discovery entry point.
 */
export const SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX =
  'Scope: this covers exactly one business — pass its id as the required `businessId`. The response ' +
  'echoes the effective `scope.businessIds` alongside it. If you have more than one business, call ' +
  '`accounter_list_business_memberships` first to choose.';

/**
 * The required singular `businessId` taken by the single-business report tools.
 *
 * `requestedBusinessIds()` in `execute.ts` recognizes this field by name and
 * narrows the resolved read scope — and therefore `x-business-scope` — to just
 * this business. That matters beyond authorization: several upstream report
 * resolvers (`incomeExpenseChart`, `profitAndLossReport`, `vatReport`) take no
 * owner argument at all and derive it from the forwarded scope, so the name of
 * this field is what points them at the right business.
 */
export const businessIdInput = z
  .string()
  .min(1)
  .describe(
    'The business (owner) id to report on — must be one of the businesses you belong to. ' +
      'Unlike the list tools this report covers exactly one business, so the id is required. ' +
      'Use accounter_list_business_memberships to discover ids.',
  );

/**
 * Re-check a tool's requested business against the resolved read scope.
 *
 * Defense in depth: the policy has already verified this business is in scope,
 * so a mismatch means the two disagree — and a business-scoped tool must never
 * reach upstream with an unauthorized owner. Deriving the owner from
 * `readScope.businessIds[0]` instead would agree today only because the policy
 * narrows the scope to exactly this one business; it would silently report on
 * the wrong business the moment the scope can hold more than one entry.
 */
export function assertAuthorizedBusiness(
  businessId: string,
  context: ToolExecutionContext,
): string {
  if (!context.readScope.businessIds.includes(businessId)) {
    throw new ToolInputError('No authorized business in scope for this report');
  }
  return businessId;
}
