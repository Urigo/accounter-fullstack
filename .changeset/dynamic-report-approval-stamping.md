---
'@accounter/server': patch
---

Add a pure `stampApprovals` helper that applies the dynamic report accountant-approval audit rules
(carry an unchanged stamp forward, system-stamp an `APPROVED` leaf that returns to `PENDING` after
its ledger fingerprint changed, user-stamp every other change, omit untouched `UNAPPROVED` leaves
and drop entities that are not leaves of the submitted tree), plus `parseLeafApprovals` for reading
stored `leaf_approvals` and the `LeafApprovals` type.
