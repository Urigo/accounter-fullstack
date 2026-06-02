---
'@accounter/client': patch
'@accounter/server': patch
---

tracking and displaying maximum dates (event, debit, and document dates) alongside minimum dates
across charges, ledger records, and transactions. It updates the GraphQL schema, helper functions,
and the frontend DateCell component to display date ranges when they differ.
