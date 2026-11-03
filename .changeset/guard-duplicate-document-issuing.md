---
'@accounter/client': patch
---

Guard against issuing the same monthly documents twice:

- `ConfirmationModal` runs `onConfirm` at most once per opening. A double-click on Confirm while
  the dialog played its exit animation used to run the action twice.
- `useApiMutation` takes an opt-in `dedupe: { windowMs }` option. A repeat of the mutation with
  identical variables is blocked, with a warning toast, while the first call is in flight and for
  `windowMs` after it settles. The guard lifts at once only when the resolver returns a
  `CommonError`. It is kept after any other failure (network or GraphQL error, an empty response,
  or a result `select` rejects), since the mutation may have run, fully or partly.
- `IssueMonthlyDocuments` uses a 20-second window, and its Issue buttons are disabled while
  issuing.
