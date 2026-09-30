---
'@accounter/client': patch
---

Prepare the dynamic report for more per-row layers, with no user-visible change: a generic `rollup`
helper now backs the sum and approval-count walks, tree rows take one `RowAnnotations` object and
render a shared `RowTrailing` end, the baseline/diff and approval logic moved into `useBaselineDiff`
and `useApprovalLayer`, and the Needs review overlay is a composable `RowVisibility`. Also fixes a
sort-code branch being duplicated under one id when dragged between the bank and the report while
the other tree already held it: it now merges into the existing branch.
