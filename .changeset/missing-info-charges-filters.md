---
'@accounter/client': patch
'@accounter/server': patch
---

Add filters to the Missing Info Charges screen.

The screen previously listed every charge with missing required info and offered no way to narrow
it. It now has the same `ChargeFilter` set as All Charges — owners, financial entities, tags,
income/expense, charge types, business trips, sorting, accountant status, free text and the
missing-information switches — with one exception: the date range is optional here, so the filter
modal opens with empty From/To dates instead of the "last year" default, and old unresolved charges
are not hidden.

`chargesWithMissingRequiredInfo` now accepts `filters: ChargeFilter`. The `allCharges` filter,
sort and pagination logic moved into a shared `fetchFilteredCharges` helper that the missing-info
query reuses with the missing-info charge ids as an id restriction, so both screens filter, sort
and paginate identically. The read scope is applied as the owner filter, so the pagination counts
cover only the charges the request may see, and an unsorted request keeps the screen's
newest-first order.

Also fixes the `allCharges` `page` argument defaulting to `1` while the resolver paginates from
`0`: a caller that omitted `page` (such as the charts screen) asked for the *second* page and got
an empty result. Both queries now default to `page: 0`.
