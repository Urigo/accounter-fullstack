---
'@accounter/client': patch
---

- **Direct Document Issuance from Contracts**: A new feature has been implemented allowing users to
  issue documents directly from individual contract cards, streamlining the workflow for generating
  contract-based documents.
- **Contract Sorting Enhancement**: The contracts displayed in the client section are now sorted by
  their start date in descending order, ensuring that the most recent contracts are always presented
  first for better visibility.
- **Document Editing Modal Refactoring**: The `EditIssueDocumentModal` has been refactored into two
  distinct components (`EditIssueDocumentModal` and `EditIssueDocumentContent`) to improve
  modularity, reusability, and maintainability across the application.
