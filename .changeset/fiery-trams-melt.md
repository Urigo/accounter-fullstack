---
'@accounter/client': patch
---

- **Form Initialization Refactor**: The `defaultValues` for the `useForm` hook in the `EditCharge`
  component have been refactored to explicitly map properties from the `charge` object to the
  `UpdateChargeInput` type. This prevents unknown attributes from being passed to the form manager.
- **Explicit Input Data Definition**: A new `chargeInputData` variable, memoized with `useMemo`, was
  introduced to clearly define the structure of the data used for form initialization, ensuring only
  expected fields are included.
- **Default Value Updates**: All form field `defaultValue` props within the `EditCharge` component
  were updated to reference the newly created `chargeInputData` object, ensuring consistency with
  the refactored form initialization.
