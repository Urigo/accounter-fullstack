---
'@accounter/server': patch
---

- **Database Cleanup**: A new migration has been added to drop the deprecated `deel_documents` and
  `deel_employees` tables from the database, streamlining the schema.
- **Enhanced Deel Contract Handling**: New functionality has been introduced to automatically
  validate and insert new Deel contracts into the database, ensuring all relevant contract
  information is persisted.
- **Refined Invoice-to-Charge Mapping**: The logic for associating Deel invoices with charges has
  been improved, now providing a more robust mapping that considers both receipt and invoice charge
  IDs.
- **Charge Cleanup Mechanism**: The `fetchDeelDocuments` resolver now includes a post-processing
  step to identify and delete any charges that end up without associated documents or transactions,
  preventing orphaned data.
- **GraphQL API Update**: The `fetchDeelDocuments` GraphQL mutation now returns a list of `Charge`
  objects instead of a boolean, providing more detailed feedback on the processed charges.
