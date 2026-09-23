---
'@accounter/client': patch
---

Dynamic report: leaf accountant statuses in the report tree can now be changed. A change is staged
as an unsaved edit: it updates the leaf and its branches' derived statuses, marks the report as
having unsaved changes, and is asked about when switching template. Toggles are disabled, with a
tooltip saying why, when no saved template is loaded, while an older baseline is pinned, and while
the report data loads. Staged statuses are cleared on template switch and after Save as new. They
are not persisted yet.
