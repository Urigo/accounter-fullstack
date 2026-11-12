---
'@accounter/client': patch
---

Fix the page becoming unclickable after closing a drawer (edit charge, insert document, edit
document, document image) opened from the charge or document actions menu. The menus are now
non-modal, so the drawer no longer restores a stale `pointer-events: none` on `<body>` when it
closes.
