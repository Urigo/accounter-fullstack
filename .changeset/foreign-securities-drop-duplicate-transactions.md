---
'@accounter/client': patch
---

Drop the duplicate transactions table from the charge's Foreign Securities accordion tab.

Each security block rendered a "Bank transactions" table listing the charge transactions carrying
that security's key — the same rows the charge's own Transactions accordion tab already shows, just
without the editing affordances. The tab now shows only what is specific to it: the security's
reference details and the matched "Portfolio activity" executions.

`ForeignSecuritiesChargeInfo` no longer selects `securities.transactions`, so the charge query stops
resolving those transactions as well. `ChargeSecurity.transactions` stays in the schema — the
executions matcher still needs the underlying transaction ids server-side, and the field remains
available to other API consumers.
