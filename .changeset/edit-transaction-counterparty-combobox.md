---
'@accounter/client': patch
---

Make the counterparty field in the edit-transaction form searchable, and offer businesses rather
than all financial entities.

The field was a plain `Select`, so picking a counterparty meant scrolling the entire list (its
placeholder literally read "Scroll to see all options"). It now uses the same `ComboBox` the other
business pickers use — the creditor/debtor fields in the misc-expense form and the debtor/creditor
fields in the document form — which has a filter input over the options.

Its options now come from `useGetBusinesses` instead of `useGetFinancialEntities`, matching the
transactions table's own counterparty cell. `allFinancialEntities` also returns tax categories,
which are never a valid transaction counterparty, so they were only noise in the list.

`ComboBox` resolves the portal container itself, so the explicit `usePortalContainer` wiring the
`Select` needed to stay clickable inside `PopUpDrawer` is gone from this form.
