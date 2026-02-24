---
'@accounter/server': patch
---

- **Database Provider Migration**: Replaced the generic `DBProvider` with `TenantAwareDBClient`
  across numerous modules, including business trips, corn jobs, and Deel invoices, to facilitate
  tenant-aware database operations.
- **Tax Category Lookup Simplification**: Refactored tax category lookups to remove the explicit
  `ownerId` parameter, now relying on the `TenantAwareDBClient` to handle tenant context implicitly.
  This involved updates to GraphQL schemas, resolvers, and DataLoader implementations.
- **SQL Query and Schema Adjustments**: Modified SQL `UPDATE` queries in charges and financial
  entities to no longer explicitly update `owner_id`. GraphQL input types and queries were also
  updated to remove `ownerId` parameters where appropriate.
- **VAT Report Logic Update**: Adjusted the logic for determining `isExpense` and `counterpartyId`
  in VAT reporting to correctly use `doc.owner_id` instead of `charge.owner_id`, aligning with the
  new tenant-aware data model.
- **Service Scope Change**: Changed the scope of `CornJobsProvider` from `Singleton` to `Operation`
  to ensure proper tenant context isolation for background tasks.
