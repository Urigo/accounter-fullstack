---
'@accounter/client': patch
---

- **New `onClose` Prop**: Introduced an `onClose` prop to the `GenerateDocument` component to allow
  external control over its closure.
- **Automated Dialog Closure**: Implemented logic to automatically call the `onClose` prop when a
  document is successfully issued, ensuring related dialogs close as expected.

