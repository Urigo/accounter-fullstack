---
'@accounter/server': minor
---

Deprecate `user_context.foreign_securities_business_id` and
`user_context.foreign_securities_fees_category_id`, superseded by `securities_context`. The server no
longer reads or writes them (a migration copies any value still missing from `securities_context`
once more and marks both columns `DEPRECATED` in their column comments; they will be dropped later).
In GraphQL, `AdminContextInput.foreignSecuritiesBusinessId` / `foreignSecuritiesFeesCategoryId` are
deprecated in favour of `updateSecuritiesContext` (they now write `securities_context`), and
`AdminContextInfo.foreignSecuritiesBusiness` / `foreignSecuritiesFeesCategory` in favour of
`securitiesContext`.
