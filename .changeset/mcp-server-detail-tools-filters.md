---
'@accounter/mcp-server': patch
---

- Enrich detail tools to support filter-based retrieval in addition to by-id retrieval:
  - `accounter_get_charges` supports full `ChargeFilter` input.
  - `accounter_get_transactions` supports `transactionsByFilters` predicates.
  - `accounter_get_documents` supports `documentsByFilters` predicates.
- Allow combining ids and filters in detail tools (ids + filters), and treat empty array inputs as
  undefined to match backend semantics.
- Refactor detail-tool GraphQL documents to use shared fragments and one multi-operation document per
  tool, selecting operations with `operationName` to keep result structures consistent and reduce
  duplicate selection sets.
- Normalize specific upstream not-found GraphQL errors from `chargesByIDs` / `transactionsByIDs` to
  empty successful results so out-of-scope or missing ids behave consistently with tool summaries.
- Tighten `RawDocument.charge.owner` typing to match selected fields (`owner { id }`) and avoid
  accidental reliance on unselected `name` fields.
