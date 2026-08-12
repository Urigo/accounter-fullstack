---
'@accounter/modern-poalim-scraper': minor
'@accounter/server': minor
'@accounter/scraper-app': patch
---

Ingest static foreign-securities reference data from Bank Hapoalim.

Poalim's "mytrade" portfolio app exposes the static details of every security held in a trading
account — name, symbol, exchange, currency, instrument type. Accounter already had a
`FOREIGN_SECURITIES` account type and recognised securities fees, but had no record of *which*
securities an account holds, so securities transactions could not be resolved against instrument
metadata. This adds the full ingestion path for that list. Live portfolio balances
(`View.Account`, `View.Account.AccountPosition.Balance`) and open orders (`View.Orders`) are out of
scope; nothing reads the stored rows yet.

`modern-poalim-scraper` gains `getSecurities(account)`, following the same
`{ data, isValid, errors }` contract as its siblings, plus the exported `HapoalimSecurities` /
`PoalimSecurity` types. Two things about this endpoint differ from the rest of the Poalim surface
and are worth knowing:

- It addresses the account as `branch-account` (no bank number), unlike the three-part `accountId`
  every other method uses.
- It is only served to callers running on the mytrade SPA's own page, and requires a `session`
  header holding a **server-issued** key — inventing one is rejected with `InvalidSessionException`.
  So the request is issued from a short-lived sibling tab on the logged-in browser context, and
  `captureMytradeSession` listens for the SPA's own `/mytrade/api/` call to harvest the real
  `session` / `csession` headers rather than guessing where the SPA stores them.

Accounts with no securities portfolio omit `View.Meta.Security` entirely; that is treated as an
empty portfolio rather than a malformed response, so it no longer fails the whole Poalim run.

`server` gains `uploadPoalimSecurities(securities: [PoalimSecurityInput!]!)` on the scraper-ingestion
module, backed by a new `accounter_schema.poalim_securities` table (migration
`2026-08-11T12-00-00.add-poalim-securities-table`) that mirrors the source fields one-to-one. The
table is owner-scoped with RLS and a `tenant_isolation` policy, and deduplicates on
`(bank_number, branch_number, account_number, security_key)`. Re-scrapes are no-ops, and changed
attributes are reported through the shared `changedTransactions` result — `as_of_date` is excluded
from that comparison since it moves on every scrape and would otherwise flag every row. These rows
are reference data, not cash movements, so there is deliberately no insert trigger and no
`transactions_raw_list` wiring.

`scraper-app` gets a per-source "Fetch foreign securities" option (off by default — the endpoint is
portfolio-specific), a `securities` column in the run progress table, and the fetch/upload steps.

Also tightens two things that this work surfaced: the shared XSRF lookup now reads cookies from the
browser context instead of the deprecated page-level cookie API, filtered by cookie domain — all
scrapers share the default browser context, so an unfiltered lookup could pick up another bank's
`XSRF-TOKEN`.
