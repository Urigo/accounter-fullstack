---
'@accounter/mcp-server': patch
'@accounter/server': patch
---

Expose the full set of query filters to the MCP tools and align tenant terminology.

- `accounter_get_charges` / `accounter_search_charges` accept the full `ChargeFilter` surface via a
  shared charge-filter schema, and the transaction/document detail tools accept their respective
  `*ByFilters` predicates alongside ids.
- Share entity shape definitions across tools so charge, transaction and document payloads stay
  consistent, and extend the schema-contract tests to guard the exposed filter surface.
- Lookup tools (businesses, tags, tax categories) expose their upstream filter arguments.
- Rename the tenant-scoping input from `businessId` to `memberBusinessId` across tool inputs, auth
  identity handling and docs, so it is no longer confused with the business entities the tools
  return.
- Server: `allCharges` now forwards `fromDate` / `toDate` to `getChargesByFilters` in addition to
  `fromAnyDate` / `toAnyDate`; previously those two filters were silently dropped and returned an
  unfiltered result.
