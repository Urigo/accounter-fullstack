---
'@accounter/client': patch
---

- **Enable Document Editing**: An 'edit' column has been introduced to the `RecentBusinessDocs`
  table, allowing for document editing functionality within the business documents tab.
- **UI Component Refactoring**: The `CloseDocumentButton` component has been refactored to utilize a
  new custom UI `Tooltip` component structure, migrating away from the `@mantine/core` library for
  this specific component.
