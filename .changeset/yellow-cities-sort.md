---
'@accounter/server': patch
---

- **Backend Schema Migration**: Updated the GraphQL schema and Zod validation to use an
  explicit-node format, replacing legacy hint arrays with a clear nodeType-based structure.
- **Legacy Template Migration**: Implemented an in-memory migration helper to automatically convert
  legacy templates to the new explicit-leaf format upon loading.
- **Tree Data Model**: Refactored the report tree to treat financial entities as explicit leaf
  nodes, ensuring consistent state management and single-presence enforcement.
