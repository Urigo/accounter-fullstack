---
'@accounter/client': patch
---

Refresh every charge a batch update touched, not just the one that was acted on.

Approving suggestions in the similar-charges dialog applies one charge's tags or description to a
whole set of other charges. The charge the user acted on refreshed correctly — its cell calls the
row's `onChange` as soon as the mutation lands — but the other approved charges did not, so any of
them that were rows in the same table kept showing their pre-approval tags and description until the
page was reloaded.

Nothing could refresh them: a row's refetch is reachable only through its own `row.original.onChange`
or through the rows currently selected in the table, and the dialog has charge ids, not rows. The
charges table now carries a charge-id → refresh registry that each row publishes into, and
`useBatchUpdateCharges` refreshes whichever of the charges the server reports as updated are on
screen. Ids that aren't rendered are skipped, so callers don't need to know what the table is
showing, and the hook is a no-op outside one.

This also covers the by-business variant of the dialog, and closes the standing TODO on
`useBatchUpdateCharges` about updating local data after a change.

One limitation: the registry is per table, so a screen rendering two charges tables refreshes rows
in the table the dialog was opened from, not the other one.
