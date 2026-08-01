import { z } from 'zod';

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
    'Limit results to these business (owner) ids — must be a subset of the businesses you belong to. ' +
      'Omit to include all of them. Use accounter_list_businesses to discover ids. ' +
      'Every returned row carries its ownerId so results can be grouped by business.',
  );

/**
 * Trailing clause appended to every business-scoped tool description, so the
 * scoping workflow is taught consistently wherever the model looks.
 */
export const SCOPE_DESCRIPTION_SUFFIX =
  'Scope: omitting `businessIds` covers every business you belong to; results are tagged with `ownerId` ' +
  'and the response echoes the effective `scope.businessIds`. If you have more than one business, call ' +
  '`accounter_list_businesses` first and pass explicit ids.';
