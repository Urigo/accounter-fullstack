---
'@accounter/client': patch
---

Replace Mantine's `Modal`, `Select`, `MultiSelect`, `Loader`, `Grid` and `Text` in the business
trip report's "add expense" dialogs with `PopUpModal`, `ComboBox`, `NegatableMultiSelect` and
`LoadingOverlay`.

`ComboBox` now accepts the `ref` and `onBlur` that react-hook-form supplies, restoring touched
state, `onBlur`-mode validation and error focus for all of its call sites.
