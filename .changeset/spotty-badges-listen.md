---
'@accounter/client': patch
---

Improve `MultiSelect` readability for large selections (closes #3891). The
collapsed "+N more" badge now shows the hidden selected labels in a tooltip on
hover/focus, and the dropdown lists checked items at the top when opened (order
is snapshotted on open so it does not reshuffle while toggling).
