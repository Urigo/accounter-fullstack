---
'@accounter/client': patch
'@accounter/server': patch
---

- **Database Schema Update**: A new "operations_count" column has been added to the
  "clients_contracts" table to store the operational limit for each contract.
- **GraphQL API Extension**: The GraphQL schema, resolvers, and database providers have been updated
  to support the "operationsLimit" field for creating, updating, and querying contract data.
- **User Interface Integration**: The client application now includes a dedicated input field for
  setting the "operationsLimit" in the contract modification dialog and displays this value in the
  contract details section.
