---
'@accounter/server': patch
---

Set the RLS business context in the demo and production seed scripts.

Every domain table is `FORCE ROW LEVEL SECURITY`, and `accounter_schema.get_current_business_id()`
raises when `app.current_business_id` is unset, so the seeds aborted with
`P0001: No business context set - authentication required` on their first write.
`scripts/seed-demo-data.ts`, `scripts/seed.ts` and `validate-demo-data.ts` now pin the context to
the deterministic admin business id (`makeUUID('business', 'Admin Business')`) before touching any
domain table, and a new integration test covers the seed with and without it.

The demo seed also verifies the context before its destructive `TRUNCATE`, which is autocommitted —
failing after it left the database cleared rather than reseeded.
