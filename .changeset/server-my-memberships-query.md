---
'@accounter/server': minor
---

Add a `myMemberships` query that returns the authenticated caller's own business memberships
(`MyBusinessMembership`: composite `id`, `businessId`, `roleId`, `businessName`), gated by
`@requiresAnyRole(["business_owner", "accountant"])`.

The memberships are resolved per request from `accounter_schema.business_users` (the same
DB-resolved auth context used everywhere else), so callers get an accurate, up-to-date scope without
relying on token claims. This backs the MCP server's server-side membership resolution: an
authenticated caller receives their businesses, and a caller with none receives an empty list rather
than an error.
