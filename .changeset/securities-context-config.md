---
'@accounter/server': minor
---

Add a per-tenant securities ledger configuration: a new `user_context.securities_context` jsonb
holds the general foreign-securities business, the tax categories that securities fees, dividends,
bond interest, withheld tax and redemption gains/losses are booked to, plus the sort code new
securities tax categories are created under. It supersedes the `foreign_securities_business_id` and
`foreign_securities_fees_category_id` columns: their values are copied in by the migration, they are
only read as a fallback, and a legacy `updateAdminContext` change to them is mirrored into it. It is
exposed as `AdminContextInfo.securitiesContext` and set through the new `updateSecuritiesContext`
mutation (business owners and accountants), which checks that every id belongs to the tenant.
