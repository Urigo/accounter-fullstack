---
'@accounter/server': patch
---

- **Introduced Temporary RLS Context Plugin**: A new plugin (rls-context-plugin.ts) was added, leveraging GraphQL Yoga's onExecute hook to establish a per-request database transaction. It sets the PostgreSQL Row-Level Security (RLS) session variable app.current_business_id for authenticated users using SELECT set_config, bridging the gap until TenantAwareDBClient is implemented.
