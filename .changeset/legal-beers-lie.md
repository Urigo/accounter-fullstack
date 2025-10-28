---
'@accounter/client': patch
'@accounter/server': patch
---

- **Database Schema Update**: The `clients_contracts` table in the database has been updated to
  replace the single `purchase_order` column (string) with a new `purchase_orders` column, which is
  an array of text (`text[]`), allowing multiple POs per contract.
- **GraphQL API Evolution**: The GraphQL schema has been modified to reflect this change, updating
  `purchaseOrder: String` to `purchaseOrders: [String!]!` across the `Contract` type,
  `CreateContractInput`, and `UpdateContractInput`.
- **Frontend User Interface**: The client-side application now supports displaying and managing
  multiple Purchase Orders. Users can add new POs, view all associated POs (with the latest one
  highlighted), and remove POs directly from the contract modification dialog.
- **Backend Logic Adaptation**: Server-side resolvers and database providers have been updated to
  correctly handle the new `purchase_orders` array when creating, updating, and querying contracts.
- **Green Invoice Integration**: The integration with Green Invoice has been adjusted to use the
  first Purchase Order from the `purchase_orders` array when generating document remarks, ensuring
  compatibility with external systems that might expect a single PO reference.
