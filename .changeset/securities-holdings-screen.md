---
'@accounter/server': patch
'@accounter/client': patch
---

Add a `/securities` screen listing every security currently held.

Until now a security's numbers were only reachable one at a time: you had to already know the
business, open `/businesses/{id}`, and click its security tab. The only query that computed a
position, `securityBusinessHistory(businessId:)`, required a business id and always paid for the
full execution list plus the transaction/charge match behind it.

**Server.** New `securityHoldings(includeClosed: Boolean = false): [SecurityHolding!]!` query, where
`SecurityHolding` is `{ id, security, position }` — the existing `SecurityBusiness` and
`SecurityPosition` types, without the execution list. It is backed by a new
`ForeignSecuritiesProvider.getExecutionsBySecurityBusiness()`, which reuses the existing
`getSecurityExecutionsByKeys` statement unchanged: that SQL already filters on
`security = ANY(...)` and returns the key on every row, so the union of every security business's
Poalim keys is fetched in one round trip and split up in memory. It deliberately skips the
transaction match, which exists only to draw charge links a holdings list does not show — so the
whole portfolio costs one query instead of four per security. A security business with no
`POALIM_SECURITY_KEY` identifier keeps an entry with no executions rather than disappearing.

Closed positions are filtered with a new `isOpenPosition` helper rather than `quantity !== 0`:
quantities are floats summed over fractional ETF and mutual-fund units, so a fully sold position
lands on a floating-point residue, not on zero. `Math.abs` is deliberate — a negative quantity means
the scraped history starts mid-life and is a data-quality signal worth surfacing, not a closed
position.

**Client.** A top-level "Securities" screen: one row per security with its current hold, average
cost, total bought/sold, descriptor badges and history dates, searchable across name/symbol/ISIN/
exchange/currency/Poalim key, sortable on every numeric and date column, with a "show closed
positions" toggle that re-queries the server. Each row links to the security's own page for the full
execution history. Money cells render each security's own `formatted` amount and there is no summed
total — rows can be quoted in different trade currencies and nothing is converted.

The descriptor badges are extracted into a shared `SecurityDescriptorBadges` component (behind a
`SecurityDescriptorFields` fragment) so the table and the security page's header card cannot drift.

Also corrects the derivation caveat on the security page, which read "Holdings are not scraped" —
the executions *are* scraped; what the bank does not report is a holding. Both the page and the new
screen now say the position is added up from the scraped trades rather than read from a reported
balance.
