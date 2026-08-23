---
'@accounter/client': patch
---

Make every charge action refresh its row in the charges table.

Editing a charge, confirming a suggested description or tags, or acting on its documents and
transactions frequently left the row showing pre-action data until the page was reloaded. The row's
own refetch plumbing was sound — `ChargeRow` threads its refetch onto `row.original.onChange` and
re-threads it whenever `updateCharge` swaps the row object — so the breakage was in the action paths
that were meant to call it.

The main culprit was `SimilarChargesByIdModal`, which carried the "charge changed" callback for the
two most common edits: description and tags, both from the table cells and from the Edit Charge
drawer. It never reset its own `open` state when it closed itself, so a repeat action on the same
mounted host set an already-`true` state, nothing re-rendered, and the callback never fired. When it
did fire it could fire several times for one action. Every close path now routes through
`onOpenChange` and `onClose` runs at most once per open; the query re-runs per open instead of
replaying a previous result, and the dialog no longer flips between controlled and uncontrolled while
that query is in flight. On top of that, the mutation hosts now report the change as soon as it
lands rather than deferring it to that dialog, capturing the criteria it compares against at action
time so the follow-up survives the row refresh.

Several actions had no refresh callback wired at all and now do: closing a document, issuing a
document (from the actions menu, the expanded panel, and the documents table), assigning a charge to
a bank deposit, and unlinking a transaction. Issuing a document from the actions menu additionally
passed `onDone`, which hands the draft back to the caller *instead of* issuing it — the button read
"Accept Changes" and no document was ever created. It now uses a new `onIssued` callback that fires
once the mutation succeeds. Every one of these reports the change only on success, so a failed
request no longer dismisses a form or refreshes the host as though it had worked.

Two supporting fixes: `InsertDocument` closed its modal before the insert resolved, and
`ChargesTable` re-derived its rows whenever the `data` prop changed identity. Callers commonly build
that array inline (`data={charge ? [charge] : []}`, `data={list.filter(...).map(...)}`), so a row
that had just been refreshed could revert to the list query's stale values on the next render; the
prop is now stabilized by content.
