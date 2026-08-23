---
'@accounter-helper/migrations': patch
'@accounter/server': minor
'@accounter/mcp-server': minor
---

Expose securities over the MCP connector.

The securities domain was reachable only through the web UI. An assistant connected over MCP knew
securities as a charge *type* and nothing more: it could not say what the tenant holds, what it paid,
what it traded, or which security is behind a charge.

**Two new tools.** `accounter_list_security_holdings` is the portfolio — one row per security with
units held, weighted average cost per unit bought, totals bought and sold, and the span of the
ingested history, with a closed-position toggle and free-text search over name, symbol, ISIN,
exchange, currency and every source identifier. Search, ordering (biggest live position first) and
the row cap happen in the tool: upstream takes no search argument, a portfolio is tens to low
hundreds of rows, and matching the `/securities` screen's own rules is what stops the two drifting.

`accounter_get_security_executions` is the trade history behind it — buys, sales, dividends,
interest, redemptions and transfers, newest first and really paginated, narrowed by security, trade
date and kind. The three identity filters union with each other, since ids, ISINs and symbols are
three ways of naming one axis; asking for one ISIN and one symbol means both securities, not the
empty overlap.

**The numbers carry their own caveats.** A position is arithmetic over a scraped trade history: the
bank reports no holding, there are no market prices anywhere in the system, pre-history holdings and
splits are invisible, a negative quantity means a history that starts mid-life, and a null amount
means nothing was ingested rather than zero. Amounts are each security's own trade currency and are
never converted. Asked what a portfolio is worth, a model will otherwise add a shekel column to a
dollar one — so the holdings tool computes the sums that *are* valid, per currency, and emits a
machine-readable `caveats` array alongside them. Quantities and average costs are never summed at
all.

**`includeSecurities` on `accounter_get_charges`**, following the existing `includeTransactions` /
`includeDocuments` idiom. A foreign-securities charge is the one place where what happened is not in
the charge: the cash leg is a bank row and the trade lives in a separate feed. Each security reports
the `securityBusinessId` the other two tools are addressed by, so a charge answer can be followed
into the portfolio. Three states stay distinct — not asked for, no key the feed knows, and a traded
key whose reference scrape is stale.

**Server:** a new `Query.securityExecutions(filters, page, limit, includeCharges)` with SQL pushdown,
reusing the existing execution and page-info types. It has two paths, because charge links and
pagination do not compose: `matchExecutionsToTransactions` is greedy and one-to-one over the sets it
is handed, so pairing a page's slice would let an execution on page 2 claim the cash movement
belonging to one on page 1 — the same execution reporting a different charge at a different page
size. Requesting links therefore switches to an unpaginated match per security, capped at ten of
them, and both paths order identically so they cannot disagree about what page 1 is. Also adds
`SecurityBusiness.ownerId`, `SecurityHistoryExecution.securityBusiness` and
`ChargeSecurity.securityBusiness`, so rows are owner-tagged, a flat cross-security list can be
grouped, and a charge reaches the security's own identity through the key-to-ISIN bridge.

**Migration:** the four securities tables' read predicates were still pinned to the singular
`get_current_business_id()`. They were all created after `rls-multi-business-scope`, whose 45-table
list they were never in, and no later migration broadened them. The consequence was a silent
narrowing rather than a leak: a request whose scope spanned several businesses saw securities for one
of them, with nothing in the response saying so. That broke the web client's business switcher, and
it would have broken the connector harder — it forwards its resolved scope upstream and echoes that
scope back, so the caller was told it had seen more than it had. Reads now follow
`get_current_business_scope()` while writes stay pinned to the explicit target, so the scraper
ingestion path is unaffected.
