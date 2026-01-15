---
'@accounter/client': patch
---

- **Refactored Modal Handling**: The `EditChargeModal` and `InsertDocumentModal` components have
  been moved from higher-level parent components (like `ChargesLedgerValidation`, `AllCharges`,
  `VatMonthlyReport`, `Charge`, and `MissingInfoCharges`) directly into the `ChargeActionsMenu`
  component. This centralizes their state management and rendering.
- **Component Renaming**: The `ChargeExtendedInfoMenu` component has been renamed to
  `ChargeActionsMenu` to better reflect its expanded functionality.
- **Expanded Charge Actions Menu**: The `ChargeActionsMenu` now directly includes 'Edit Charge' and
  'Insert Document' options, which trigger their respective modals using internal state, simplifying
  the prop drilling previously required.
- **Simplified Parent Components**: Numerous parent components no longer need to manage the state or
  pass down props related to `EditChargeModal` and `InsertDocumentModal`, leading to cleaner and
  less coupled code.
