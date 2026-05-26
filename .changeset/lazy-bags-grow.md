---
'@accounter/server': patch
---

* **Backend Context Resolution**: Updated the AdminContextProvider to dynamically resolve the owner ID based on the active read scope, improving support for multi-business environments.
* **User Context Enrichment**: Enhanced the user context resolver to fetch and display business names for memberships by integrating with the FinancialEntitiesProvider.
