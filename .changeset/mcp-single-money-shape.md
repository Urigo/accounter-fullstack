---
'@accounter/mcp-server': patch
---

Collapse the three hand-written money shapes onto one.

`normalizeAmount` in `tools/entity-shapes.ts` is meant to be the single definition of how money
appears in a tool result, but the same `raw -> value` mapping had been rewritten by hand in
`search_charges` (`charges.ts`) and `balance_report` (`reports.ts`). Three copies, nothing keeping
them in step — drift that had already started rather than a hypothetical one.

Both now call `normalizeAmount`. The emitted JSON is unchanged: same keys, same values, same order.
The only type-level change is that a balance-report row's `amount` is now `NormalizedAmount | null`
rather than non-nullable. That is the safe direction — the value is never null in practice, and a
shape that permits more than it emits cannot violate a schema, which matters if these rows ever get
a declared `outputSchema`.

Pinned by a contract test in `entity-shapes.test.ts` that asserts the key set against the tools'
real output rather than by grepping the source, so a fourth copy that happens to be correct today
still has to stay correct. Verified it bites: reintroducing the mapping with `amount` in place of
`value` fails with `expected [ 'amount', 'currency', 'formatted' ] to deeply equal [ 'currency',
'formatted', 'value' ]`.

Context: this is groundwork from the blind-connector postmortem. Any future `outputSchema` has to be
generated from a single source to be truthful, and the money shape was the clearest place where that
single source had already been lost.
