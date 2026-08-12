---
'@accounter/server': minor
'@accounter/client': minor
---

Show the traded security's details on foreign-securities charges.

`accounter_schema.poalim_securities` has held Poalim's static securities reference list since the
ingestion work landed, but nothing read it. Expanding a `FOREIGN_SECURITIES` charge showed
transactions with opaque descriptions like `ניע"ז מכירה 0005129523` and nothing about _which_ paper
was traded. This adds the first read path out of that table: a "Foreign Securities" accordion item
under charge extended info, peer to Bank Deposit and CreditCard Transactions.

`server` gains a `foreign-securities` module exposing `ForeignSecuritiesCharge.securities`, a list of
`ChargeSecurity` — the security key each of the charge's transactions references, the matching
`Security` reference details, and the transactions that resolved to that key. The key is parsed out
of `transactions.source_description`, where Poalim embeds it zero-padded (`0005129523` → security key
`5129523`). The padding is what makes the key distinguishable from the other digit runs descriptions
carry, so a leading zero is required rather than incidental; the normalization rule is now shared
with the `cron-jobs` reference-merge helper that already relied on it.

Two details of the lookup worth knowing:

- The query carries no `owner_id` predicate. The table is `FORCE ROW LEVEL SECURITY` with a
  `tenant_isolation` policy, so going through `TenantAwareDBClient` is what scopes it — which also
  means the provider must never be handed a raw `DBProvider`.
- The dedup key is `(owner_id, bank_number, branch_number, account_number, security_key)`, so one
  tenant holding the same paper in two accounts has two rows for one key. The lookup collapses them
  to the most recently scraped row rather than picking arbitrarily.

Keys with no matching row are returned as unresolved entries — rendered with their key and a "not
found in the ingested securities list" note — instead of being dropped, so a stale or missing scrape
is visible rather than silently hiding a transaction's instrument.

`client` renders each security with its English and Hebrew names, symbol, and exchange / currency /
instrument-type badges, above that key's transactions. The section rides on the existing deferred
charge-expansion fragment, so non-securities charges are unaffected and pay nothing for it.
