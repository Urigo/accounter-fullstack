---
'@accounter/client': patch
---

Dynamic report: a "Save review" action replaces the locked-only "Capture baseline" menu item. It
writes a snapshot only (with the staged accountant statuses) and never touches the template row, so
it is available on locked templates and, whenever staged statuses are the only unsaved change, on
unlocked templates too — both in the template menu and as a primary button next to the "Unsaved
changes" indicator. Resave still saves structure and statuses together.
