---
'@accounter/client': patch
---

Rebuild the All Documents screen on the shared documents table.

The screen maintained its own column set that was strictly weaker than the shared table: it never
fetched `documentType`, `description`, `remarks`, `allocationNumber`, `missingInfoSuggestions` or
`issuedDocumentInfo`, so none of the missing-data indicators worked; it rendered an inline thumbnail
per row; it had no edit affordance and no way to reach the containing charge; and its image modal was
unreachable dead code.

- Added `DocumentActionsMenu`, a per-row dropdown modelled on `ChargeActionsMenu`: edit the document,
  view its image, open its file and — opt-in per host — open or copy a link to its charge. It
  replaces the stacked `edit` column for every consumer of the shared table, and the close / issue
  actions for OPEN issued documents move into it unchanged.
- Extracted the duplicated image preview into `DocumentImageDrawer`, reused by the files cell, the
  edit-document form and the new menu. `CloseDocumentButton` gained optional controlled
  `open`/`setOpen` props so a menu item can drive it.
- Split the shared table into a `useDocumentsTable` hook (fragment unmasking, `@defer` merging, row
  callbacks, table instance) and the presentational `DocumentsDataTable`, so a screen can host its
  own pagination and column-visibility controls while still rendering the shared rows.
  `DocumentsTable` keeps its API; the unused `limited` prop became `columnIds`.
- The screen now selects `TableDocumentsRowFields` and drops its bespoke columns, including the
  nested related-transactions table (superseded by "Open Charge") and the dead image modal. The
  upload and edit modals moved out of the fetching branch so a refetch no longer unmounts them.
- Exposed the filters the server already supported: document type, invalid documents
  (`missingInfo`), missing counterparty and free text. Blank free text is dropped on submit, and the
  flag switches are controlled so "Clear" resets them.
