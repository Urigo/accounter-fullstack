---
'@accounter/server': patch
'@accounter/client': patch
---

The dynamic report's default diff baseline is now the newest snapshot saved for the period and owner
on screen, not simply the newest snapshot. `DynamicReportSnapshotMeta` exposes `scopeOwnerId` so the
client can make that match, and the baseline picker's "Last save" label marks the chosen snapshot
instead of the first item in the list. When no snapshot matches, the newest one is still used and
the diff stays suspended, as before.
