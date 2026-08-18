---
'@accounter/mcp-server': patch
---

Add `accounter_explain_terminology`, a read-only glossary of Accounter's core domain vocabulary.

Every other tool returns data; none explain what the data means, and the gaps are load-bearing. A
"charge" is an aggregate grouping transactions, documents and ledger records for one economic event,
not a bank charge. `byOwners` and `byBusinesses` ask opposite questions — owner versus counterparty —
a distinction that has already caused a scoping bug here. `INTERNAL` and `CONVERSION` charges are
money moving between the caller's own accounts and double-count in any spend total. Ledger slot 2 is
the VAT split, so summing slot 1 alone drops the VAT leg. Only _business_ entities are required to
balance; tax categories are expected to carry the residue. None of that is inferable from the schema,
and it cannot live in per-tool `description` strings, which every caller pays for on every
`tools/list` and which cannot carry concepts spanning tools.

The tool carries 62 entries across six topics (`charge`, `transaction`, `document`, `ledger`,
`entity`, `scope`). Called with no arguments it returns a one-line index of every term (~10 KB) so
orientation is cheap; `terms` looks up specific ones and `topics` returns a whole area in full
(~40 KB for everything, inside the 60 KB payload guard). Term matching folds case and separators, so
enum tokens (`INTERNAL`), GraphQL type names (`InternalTransferCharge`) and field names
(`effectiveDate`) all resolve, with a substring fallback. An unmatched term is reported under
`unmatched` with suggestions rather than failing the call — a glossary that errors on an unknown word
is useless for the case it exists for.

Two properties set it apart from the other tools, both deliberate:

- **Pure.** The handler never touches the upstream client, so there is no GraphQL call and no
  `x-business-scope` to forward. The registry-wide guard in `scope-forwarding.test.ts` grows a named
  `PURE_TOOLS` set rather than a loosened assertion, so a _data_ tool that drops scope still fails.
- **Unscoped.** `requiresBusinessScope: false` with `dataClassification: 'public'` — static reference
  text with no customer data, readable by a caller with zero memberships, the same reasoning that
  applies to membership discovery.

It registers second in `tools/list`, behind `accounter_list_business_memberships` and ahead of the
data tools, so the discovery-first contract is unchanged.

A glossary's failure mode is going stale silently, so the content is pinned to the package's own
constants: `terminology-contract.test.ts` asserts that every `CHARGE_TYPES` token,
`KNOWN_CHARGE_TYPENAMES` value and `ACCOUNTANT_STATUSES` token resolves to an entry, that every
cross-reference names a real term and a registered tool, and that no alias is claimed by two entries.
A charge type added upstream now fails the suite instead of quietly going undefined.
