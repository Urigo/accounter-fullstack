import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Drop `membership_business_visibility`, an RLS policy that was a mistake.
 *
 * It was added to keep the client's business switcher readable: membership
 * names resolve through `financial_entities`, which the request's
 * `X-Business-Scope` narrows, so once a user picked a scope the names of their
 * *other* businesses — the very list needed to leave that scope — came back as
 * bare UUIDs.
 *
 * The policy fixed that by making a user's own membership businesses readable
 * regardless of scope. But a policy governs the *table*, not one query, so it
 * equally widened `SELECT * FROM financial_entities` — the counterparty
 * pickers. Scoped to one business, those pickers began listing the user's other
 * businesses. A scope leak in exchange for a display fix.
 *
 * No policy is needed. A business's own `financial_entities` row is self-owned
 * (`owner_id = id`, set by `setSelfOwner` during client bootstrap), so a request
 * that sends no `X-Business-Scope` already reads every membership's row through
 * `tenant_isolation` — its scope defaults to all memberships. The client now
 * sends that one membership query unscoped instead, which is the same rule the
 * MCP connector documents for its own membership bootstrap.
 *
 * Written as a migration rather than by deleting the original: migrations are
 * skipped once their name is recorded and there is no down-path, so a database
 * that already ran it would otherwise keep the policy with nothing in the tree
 * to explain it. `IF EXISTS` makes this a no-op on a fresh database.
 */
export default {
  name: '2026-08-27T10-00-00.drop-membership-financial-entities-policy.sql',
  run: ({ sql }) => sql`
    DROP POLICY IF EXISTS membership_business_visibility ON accounter_schema.financial_entities;
  `,
} satisfies MigrationExecutor;
