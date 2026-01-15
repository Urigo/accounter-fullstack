---
'@accounter/client': patch
---

- **Optional Charge ID**: The `chargeId` prop has been made optional for both `EditChargeModal` and
  `InsertDocumentModal`, allowing these components to be rendered without an initial charge ID.
- **EditChargeModal Refactoring**: The `EditChargeModalContent` component was merged into
  `EditChargeModal`, simplifying the component structure. Data fetching within `EditChargeModal` now
  uses `useQuery` with a `pause` option and a `useEffect` hook to dynamically fetch data only when a
  `chargeId` is present.
- **Conditional Rendering**: Both modals now include early return statements to render `null` if the
  `chargeId` is not provided, ensuring that content dependent on `chargeId` is only displayed when
  available.
- **Default onChange Prop**: The `onChange` prop passed to the `EditCharge` sub-component now
  defaults to an empty function if not explicitly provided, preventing potential runtime errors.
