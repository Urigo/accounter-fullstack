---
'@accounter/server': patch
---

- **Deel Contract Schema Validation**: New Zod schemas are introduced for comprehensive validation
  of Deel contract data, ensuring data integrity and type safety across the application.
- **Deel Contract Details API Integration**: A new public method, `getContractDetails`, has been
  added to the `DeelClientProvider` to fetch detailed contract information directly from the Deel
  API, complete with robust error handling and schema validation.
- **Enhanced Invoice-Contract Matching**: The invoice processing logic in `fetchAndFilterInvoices`
  now actively verifies that all invoices are linked to existing contracts. If a contract ID is not
  found locally, it fetches details from Deel and raises an error, guiding users to manually match
  the contract to prevent data inconsistencies.
- **Dynamic Charge Creation for Receipts**: The process for generating charges for new Deel receipts
  has been refactored. Charges are now dynamically created within the resolver when a receipt is
  encountered without an existing charge, streamlining the financial reconciliation workflow.
