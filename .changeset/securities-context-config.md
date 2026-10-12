---
'@accounter/server': minor
---

Add a per-tenant securities ledger configuration: a new `user_context.securities_context` jsonb
holds the tax categories that securities dividends, bond interest, withheld tax and redemption
gains/losses are booked to, plus the sort code new securities tax categories are created under.
It is exposed as `AdminContextInfo.securitiesContext` and set through the new
`updateSecuritiesContext` mutation (business owners and accountants), which checks that every id is
one of the tenant's tax categories and the sort code exists.
