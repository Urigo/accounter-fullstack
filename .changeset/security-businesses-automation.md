---
'@accounter/server': minor
---

Create a security's business when its executions arrive, and suggest it as the trade's counterparty.

**Ingestion.** `uploadPoalimSecuritiesTransactions` now gives every security in the payload a business
of its own and records the Poalim key it is known by, through `ensureSecurityBusiness` /
`linkIdentifier`. Driven off the whole validated payload rather than only the newly inserted rows: a
re-scrape inserts nothing, but a security whose business was never created — ingested before this
existed, or created while an earlier scrape failed here — still needs one. Both steps are idempotent
and the existing ISINs are fetched in a single query, so a repeat scrape costs one lookup. Two Poalim
keys reporting the same ISIN collapse onto one business, which is the point of keying on the ISIN.

Rows with no ISIN are skipped: the ISIN is the identity and one cannot be invented from the Poalim
key alone, so those securities stay unlinked and are assigned by hand. Failures are logged rather
than thrown — the executions are already stored, and reporting the upload as failed would be a lie;
the next scrape repairs the gap.

**Suggestion.** A securities trade names the security it traded in its description, and that key now
resolves to a business: `Transaction.missingInfoSuggestions` returns the security rather than falling
through to the POALIM description heuristics, which would otherwise claim it for the bank. Only when
the description names exactly one key, and only for the main transaction — a fee row returns Poalim
before this point, unchanged, which is what keeps the fee ledger entry as it is. A key with no
security business behind it (no ISIN reported, or not ingested yet) falls through to the old
behavior rather than inventing a suggestion.

Also drops an unreachable `transaction.business_id` branch in the suggestion resolver: the function
returns null for any transaction that already has a counterparty, several lines above it.
