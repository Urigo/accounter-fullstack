import { z } from 'zod';
import { shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';

/**
 * Tool 0: business discovery (spec §8.2).
 *
 * The connector is stateless — no `Mcp-Session-Id`, no session store, auth
 * re-derived per request — so there is no "active business" to hang scope on.
 * This tool is the entry point instead: the model enumerates the businesses the
 * caller can read, then passes the returned ids back as `businessIds` to the
 * business-scoped tools.
 *
 * The handler is **pure**: memberships are already resolved on the auth context
 * by `resolveAuthContext` (via the upstream `myMemberships` query), so listing
 * them costs no upstream call.
 */

export const LIST_BUSINESSES_TOOL_NAME = 'accounter_list_businesses';

const listBusinessesInput = z.object({});
type ListBusinessesInput = z.infer<typeof listBusinessesInput>;

interface BusinessSummary {
  businessId: string;
  name: string | null;
  role: string;
}

// Fixed-locale collator so ordering is deterministic across hosts/runtimes
// rather than depending on the ambient default locale (mirrors `lookups.ts`).
const NAME_COLLATOR = new Intl.Collator('en', { sensitivity: 'base' });

/**
 * Normalize a display name: absent, `null`, or blank (whitespace-only) all mean
 * "no name" and become `null`. Doing this once at the boundary keeps `name`
 * either a meaningful string or `null`, so the comparator never has to decide
 * whether `''` counts as named — and callers never see an empty display string.
 */
function normalizeName(businessName: string | null | undefined): string | null {
  return businessName && businessName.trim().length > 0 ? businessName : null;
}

/**
 * Stable order: by name (case-insensitive, fixed-locale), tie-broken by id.
 * Unnamed businesses sort last so the readable ones lead, and ties among them
 * still resolve deterministically by id.
 *
 * The named/unnamed test is an explicit `!== null` rather than truthiness: with
 * truthiness an empty-string name counts as unnamed for branch selection but as
 * *distinct from* `null` in the tie-break, which made the comparator return `1`
 * in both directions when comparing `''` against `null` — not antisymmetric, so
 * the sort became unstable rather than merely mis-ordered.
 */
function byNameThenId(a: BusinessSummary, b: BusinessSummary): number {
  if (a.name !== null && b.name !== null) {
    const byName = NAME_COLLATOR.compare(a.name, b.name);
    if (byName !== 0) return byName;
  } else if (a.name !== b.name) {
    // Exactly one is unnamed — the named one leads.
    return a.name === null ? 1 : -1;
  }
  return a.businessId < b.businessId ? -1 : a.businessId > b.businessId ? 1 : 0;
}

function handler(_input: ListBusinessesInput, context: ToolExecutionContext): ToolResult {
  const businesses = context.auth.memberships
    .map(membership => ({
      businessId: membership.businessId,
      name: normalizeName(membership.businessName),
      role: membership.roleId,
    }))
    .sort(byNameThenId);

  return shapeListResult({
    items: businesses,
    itemsKey: 'businesses',
    total: businesses.length,
    summarize: (shown, total) =>
      total === 0
        ? 'You do not have access to any businesses.'
        : `You have access to ${total} business(es)${shown < total ? ` (showing ${shown})` : ''}. Pass their businessId values as businessIds to the other tools.`,
  });
}

export const listBusinessesTool: ToolDefinition<typeof listBusinessesInput> = {
  name: LIST_BUSINESSES_TOOL_NAME,
  description:
    'List the businesses you have access to, with your role in each. Call this first when you may have access to more than one business, then pass the returned `businessId` values as `businessIds` to the other tools. Read-only; takes no parameters.',
  inputSchema: listBusinessesInput,
  policy: {
    // Deliberately false: a caller with zero memberships should get an empty
    // list and a helpful summary, not an AUTHORIZATION_ERROR. This is the
    // discovery entry point — failing it hard would leave the model with no way
    // to learn that it has no access.
    requiresBusinessScope: false,
    dataClassification: 'business',
  },
  handler,
};
