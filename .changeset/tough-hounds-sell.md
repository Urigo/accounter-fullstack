---
'@accounter/client': patch
---

- Extend `batch-update-dialog.tsx`:
  - **Tags** — a `MultiSelect` (via `useGetTags`), merged with the existing description into a
    single `suggestions` input.
  - **Flags** — `isActive`, `isReceiptEnough`, `isDocumentsOptional` (No docs required),
    `optionalVAT` (Is VAT optional) and `exemptDealer` as tri-state selects (**No change / Yes /
    No**). A flag is only sent when the user explicitly picks Yes/No, preserving the "only fields
    you fill in are applied" semantics of batch update.
  - `isFormEmpty` is now derived from the built mutation input so the new controls correctly
    enable/disable the Save button.
