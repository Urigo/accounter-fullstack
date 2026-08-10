---
'@accounter/mcp-server': minor
'@accounter/server': minor
---

Complete the MCP tools' input surface, rename the scope field to membership terminology, and put an
owner on every row.

**Full filter coverage.** The tools wrapped only part of each upstream filter input, and the gap was
silent — a predicate the schema supports was simply unreachable through MCP.

- `accounter_search_charges` exposed 5 of 23 `ChargeFilter` fields; it now takes every predicate
  upstream honors (charge types, accountant status, counterparty and business trips, ordering, the
  `without*`/`with*` document/transaction/ledger flags), flat alongside its existing arguments. Both
  charge tools build their filter from one shared definition (`tools/charge-filters.ts`).
- Date semantics are now separable and documented: `fromDate`/`toDate` remain the *overlap* pair
  (upstream `fromAnyDate`/`toAnyDate`), and `fromMainDate`/`toMainDate` expose the narrower
  *containment* pair. `sortBy` is caller-overridable, still defaulting to newest-first.
- Pagination reaches results that were previously unreachable: `accounter_get_charges` takes
  `page`/`pageSize` (it was pinned to the first page of `allCharges`), and
  `accounter_list_businesses` takes `page` and forwards `limit`/`page` to `allBusinesses`. Both echo
  `pagination`.
- `businessTrip`, `byFinancialAccounts` and `unbalanced` are deliberately **not** accepted: upstream
  takes them and never passes them to the SQL, and a filter that silently matches everything is worse
  for a model than an absent one.
- New contract tests compare each tool's input keys against `input ChargeFilter` / `DocumentsFilters`
  / `TransactionsFilters` in the generated schema, so a field added upstream fails the suite instead
  of quietly becoming unreachable.

**Membership terminology (breaking tool-input change).** The scope field was `businessIds`, one
letter from the charge filter `byBusinesses` and the documents filter `businessIds` — both
*counterparty* predicates, a confusion that previously caused a real scoping bug. Every tool now
takes `memberBusinessIds` (`memberBusinessId`, singular and required, on `accounter_balance_report`),
responses echo `scope.memberBusinessIds`, and `accounter_list_business_memberships` emits
`memberBusinessId` rows. Internals follow (`AuthorizedReadScope`, `BusinessMembership`, the policy and
executor parameters). The `x-business-scope` header and the upstream payload keys are unchanged — they
are contracts with the GraphQL server, not MCP vocabulary. **Callers passing `businessIds` now get a
`VALIDATION_ERROR` rather than silently unscoped results.**

**Owner on every row.** A caller with several memberships got a merged list it could not attribute:
transactions carried no owner at all, and documents dropped theirs.

- Server: `Charge`, `Document` and `Transaction` expose `ownerId: UUID!`, served off the row each
  type's shared DataLoader already fetches, so no query is added per row.
- MCP: charges, transactions, documents, balance rows and the charge-nested `transactions` /
  `documents` all carry `ownerId`. `accounter_get_transactions` can now apply the same
  defense-in-depth owner filter as the charge and document tools, which previously relied on RLS
  alone.

**Server, also:** `allCharges` now forwards `fromDate`/`toDate` to the provider. The SQL always had
the containment predicate, but only the `*AnyDate` pair was wired up, so a caller passing
`fromDate`/`toDate` got an unfiltered result instead of a narrower one.
