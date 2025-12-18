---
'@accounter/client': patch
---

- **Dialog State Management**: The `ModifyContractDialog` component has been refactored to manage
  its own open/close state and form data internally, reducing reliance on parent components.
- **Component Decoupling**: The `ContractsSection` component no longer maintains local state for the
  contract being edited, simplifying its logic and improving component separation.
- **Form Initialization**: Enhanced form reset logic within `ModifyContractDialog` ensures that the
  form is correctly populated with the relevant contract data upon opening or context changes,
  preventing stale data issues.

