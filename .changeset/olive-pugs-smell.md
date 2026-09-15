---
'@accounter/client': patch
---

Fix the `NegatableMultiSelect` option list being unscrollable: its popover is now modal, so a
list longer than its 300px cap can be scrolled inside a dialog instead of only searched.
