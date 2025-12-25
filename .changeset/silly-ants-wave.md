---
'@accounter/server': patch
---

- **Flexible Document Requirement**: Introduced logic to conditionally require document entries
  based on a new `charge.documents_optional_flag`, allowing charges to be processed even without
  associated documents if specified.
- **Dynamic Invoice Date Calculation**: Modified the `invoiceDate` determination to use the earliest
  transaction `valueDate` when documents are optional, ensuring proper ledger entry creation for
  charges without associated documents.
- **Refined Error Handling**: Updated error messages to be more specific regarding missing
  transaction or document entries, aligning with the new conditional requirement for documents.
