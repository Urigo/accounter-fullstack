---
'@accounter/client': patch
'@accounter/server': patch
---

- **Duplicate Contract Feature**: Introduced the ability to duplicate existing contracts, allowing
  users to quickly create new contracts based on an existing one's details.
- **User Interface Enhancements**: Added a dedicated 'Duplicate Contract' button to the contract
  card and integrated a new option within the contract modification dialog to deactivate the
  original contract upon duplication.
- **Backend Flexibility for Purchase Orders**: The `purchaseOrders` field in contract updates has
  been made optional, both in the GraphQL input type and the resolver logic, to accommodate cases
  where it might be empty or undefined.
