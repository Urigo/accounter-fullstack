---
'@accounter/client': patch
---

- **Charge Editing Flow**: The `EditChargeModal` now correctly closes itself and triggers the
  `onChange` callback when an edit operation is completed, improving the user experience for charge
  modifications.
- **UI Layering Fix**: A `zIndex` property has been added to the 'Year of relevance' date picker
  within the `ChargeSpreadInput` to ensure its popover renders above other UI elements, preventing
  display issues.
- **Similar Charges Modal Logic**: The `SimilarChargesByIdModal` now includes logic to automatically
  close if it's opened without any valid search criteria (i.e., `tagIds` or `description`),
  preventing an empty or irrelevant modal from appearing.
- **Drawer Interaction**: An `onClick` event handler with `stopPropagation()` has been added to the
  `DrawerContent` component to prevent clicks within the drawer from propagating to underlying
  elements, enhancing interaction isolation.
