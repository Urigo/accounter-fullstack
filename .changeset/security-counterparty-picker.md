---
'@accounter/client': minor
---

Offer securities, and only securities, as the counterparty of a foreign-securities trade.

The main transaction of a securities charge settles against the security it traded, so the picker
that appears when it has no counterparty yet now lists the tenant's security businesses plus the
general foreign-securities business — the fallback for a trade whose security cannot be told — rather
than the whole business directory, where the right answer is a needle in a haystack and a wrong one
is one click away. Each option carries its ISIN, which is what tells two share classes of one issuer
apart.

The fee row is the bank's and keeps the full list, matching what the suggestion resolver does on the
server.

The rule is decided client-side from what the charge already knows, so `chargeType` — typed as the
shared `ChargeType` union rather than a bare string, since it is compared against typename literals —
is threaded from `charge-extended-info` through `ChargeTransactionsTable` and `TransactionsTable`
onto the row, the same way `enableEdit` and `enableChargeLink` are. The other `TransactionsTable`
callers pass no charge type and are unaffected: `useGetSecurityBusinesses` takes a `pause` flag, so a
plain transactions table does not run the securities query once per row for a list it never shows.

`UserContext.foreignSecuritiesBusinessId` is read through the user provider for that fallback option,
and `useGetSecurityBusinesses` is the securities-scoped counterpart of `useGetAdminBusinesses`.

The suggestion itself needs no client change: the cell already pre-seeds the select from
`missingInfoSuggestions`, which now resolves the security named in the trade's description.
