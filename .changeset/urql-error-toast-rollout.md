---
'@accounter/client': patch
---

Adopt `useQueryErrorToast` across the remaining lookup hooks.

Nine hooks still reported query failures from the hook body, so the toast fired on every render for
as long as `error` was set and — with no toast id for sonner to recognise repeats by — stacked a new
notification each time: `useGetTags`, `useGetTaxCategories`, `useGetFinancialEntities`,
`useGetFinancialAccounts`, `useGetOpenContracts`, `useGetBusinessTrips`, `useGetSortCodes`,
`useAllCountries` and `useGetAllClients`.

Two more already used an effect and were correct; they are folded in so there is a single pattern,
and gain the toast id: `useGetAdminBusinesses` and `useGetSecurityBusinesses`.

No toast changes. Each hook's subject noun reproduces its original strings exactly — the conversion
was applied by a script that parsed `Error fetching <subject>` and `Unable to fetch <subject>` out of
each site and asserted the two agreed before rewriting, so a hook whose strings had drifted would
have failed the run rather than being silently renamed. The console call now passes the error as a
separate argument rather than interpolating it, which is the one deliberate difference.
