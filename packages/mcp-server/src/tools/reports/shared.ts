import { z } from 'zod';
import { ToolInputError } from '../execute.js';
import type { ToolExecutionContext } from '../registry.js';

/**
 * Pieces shared by the single-business report tools under `reports/`.
 *
 * Each report covers exactly one business the caller is a member of, so they
 * all take the same required `memberBusinessId` input and run the same
 * membership check before reaching upstream.
 */

/** The required single-business input, described identically by every report tool. */
export const memberBusinessIdInput = z
  .string()
  .min(1)
  .describe(
    'The business to report on — must be one of the businesses you are a member of. ' +
      'Unlike the list tools this report covers exactly one business, so the id is required. ' +
      'Use accounter_list_business_memberships to discover ids.',
  );

/**
 * Returns the business a single-business report tool should report on: the one
 * the caller actually asked for. Deriving it from the scope instead
 * (`readScope.memberBusinessIds[0]`) happens to agree today only because the
 * policy narrows the scope to exactly this one business — it would silently
 * report on the wrong business the moment the scope can hold more than one
 * entry.
 *
 * The membership check is defense in depth: the policy has already verified
 * this business is in scope, so a mismatch means the two disagree, and a
 * business-scoped tool must never reach upstream with an unauthorized owner.
 */
export function assertMemberBusiness(
  context: ToolExecutionContext,
  memberBusinessId: string,
): string {
  if (!context.readScope.memberBusinessIds.includes(memberBusinessId)) {
    throw new ToolInputError('No authorized business in scope for this report');
  }
  return memberBusinessId;
}
