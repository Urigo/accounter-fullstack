---
'@accounter/server': patch
---

- **Row Level Security (RLS) Enabled on Charges Table**: A new database migration has been
  introduced to enable Row Level Security on the `accounter_schema.charges` table, including an
  index on `owner_id` and a `tenant_isolation` policy to ensure data separation by business ID.
- **Temporary RLS Provider Workaround**: To facilitate the RLS transition, a temporary workaround
  has been implemented in the `ChargesProvider`. It now injects the `AccounterContext` and uses a
  new `getRlsDbClient` helper to ensure all database queries respect RLS policies until the
  `TenantAwareDBClient` is fully integrated in a later phase.
- **RLS Helper Function**: A new `getRlsDbClient` helper function has been added to
  `rls-context-plugin.ts` to provide an RLS-enabled database client, falling back to the regular
  provider if no RLS context is available.
- **Test Utility Adjustment**: The test utility `ledger-injector.ts` was updated to accommodate the
  new constructor signature of `ChargesProvider`, passing an empty `AccounterContext` for testing
  purposes.
