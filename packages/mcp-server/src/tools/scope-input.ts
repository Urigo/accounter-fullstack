import { z } from 'zod';

/**
 * Shared membership-scope input fragment.
 *
 * Every business-scoped tool takes the *same* optional `memberBusinessIds` field
 * with the *same* description, so the model learns one scoping convention
 * instead of a different one per tool. Kept in its own module so the registry
 * never has to depend on zod.
 *
 * The name is deliberate. These ids are the businesses the caller is a *member
 * of* — the access-control axis, resolved from `myMemberships` — and they end up
 * as the upstream `byOwners` / `ownerIDs` predicate. Calling the field
 * `businessIds` put it one letter away from the charge filter `byBusinesses`,
 * which is the *counterparty* predicate and a completely different question;
 * scoping was once wired to that field by mistake (see
 * `docs/coherent-owner-scoping-for-mcp/plan.md`). `memberBusinessIds` cannot be
 * confused for either the counterparty filter or the row-level `ownerId`.
 *
 * `requestedMemberBusinessIds()` in `execute.ts` accepts either this array or a
 * singular `memberBusinessId`, so adding the field to a tool needs no plumbing —
 * the resolved scope flows to `x-business-scope` automatically.
 */

/** Upper bound on requested ids, matching the charges tool's original cap. */
export const MAX_REQUESTED_MEMBER_BUSINESS_IDS = 50;

export const memberBusinessIdsInput = z
  .array(z.string().min(1))
  .max(MAX_REQUESTED_MEMBER_BUSINESS_IDS)
  .optional()
  .describe(
    'Limit results to these businesses you are a member of — must be a subset of your memberships. ' +
      'Omit to include all of them. Use accounter_list_business_memberships to discover ids. ' +
      'Every returned row carries its ownerId so results can be grouped by business.',
  );

/**
 * Trailing clause for the **multi-business list tools** — those taking the
 * optional {@link memberBusinessIdsInput} and returning owner-tagged rows.
 *
 * Not applicable to single-business tools: it would promise an optional
 * `memberBusinessIds` field and per-row `ownerId` that they do not have. Use
 * {@link SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX} there instead.
 */
export const SCOPE_DESCRIPTION_SUFFIX =
  'Scope: omitting `memberBusinessIds` covers every business you are a member of; results are tagged ' +
  'with `ownerId` and the response echoes the effective `scope.memberBusinessIds`. If you belong to ' +
  'more than one business, call `accounter_list_business_memberships` first and pass explicit ids.';

/**
 * Trailing clause for tools scoped to exactly **one** business via a required
 * singular `memberBusinessId`. States only what is actually true of them: no
 * optional `memberBusinessIds`, no per-row `ownerId` (every row shares the one
 * owner, which the response reports once), but the same discovery entry point.
 */
export const SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX =
  'Scope: this covers exactly one business — pass its id as the required `memberBusinessId`. The ' +
  'response echoes the effective `scope.memberBusinessIds` alongside it. If you belong to more than ' +
  'one business, call `accounter_list_business_memberships` first to choose.';
