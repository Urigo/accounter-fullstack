---
'@accounter/mcp-server': patch
'@accounter/server': patch
---

Coherent owner/business scoping for the MCP connector.

The connector handled multi-business ownership three inconsistent ways and never forwarded the
caller's business scope upstream, so scope-less queries could not be narrowed at all and results were
not attributable to a business.

**Server** — expose `Tag.ownerId` (`UUID!`), backed by a migration that appends `owner_id` to the
`accounter_schema.extended_tags` view.

**MCP server**

- Forward the resolved read scope upstream as `x-business-scope` on every tool call, so RLS on the
  Accounter server is the enforcement point. The upstream context is built once where the scope is
  known, so a tool handler cannot omit it. The membership bootstrap (`myMemberships`) is deliberately
  never scoped — it is the query that discovers the scope.
- Fix charges scoping: filter by `byOwners` (the owner predicate) instead of `byBusinesses` (the
  counterparty predicate, from which upstream removes the owner), which had been returning only
  inter-company charges. The balance report now uses the requested `businessId` rather than the first
  id in scope.
- Add `accounter_list_businesses`, a read-only discovery tool listing the caller's businesses and
  role in each. Registered first so it leads `tools/list`; the internal `accounter_smoke_ping` is no
  longer advertised, though it remains dispatchable.
- Uniform scoping contract: every business-scoped tool takes the same optional `businessIds`, rows
  carry `ownerId` (charges also `ownerName`), and responses echo the effective `scope.businessIds`.
  Out-of-scope ids are rejected rather than silently dropped.
- Extend GraphQL codegen document discovery to `src/upstream/*.ts`, so the membership query is
  validated against the schema like the tool queries.
