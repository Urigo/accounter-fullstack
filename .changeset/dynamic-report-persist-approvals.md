---
'@accounter/client': patch
---

Dynamic report: Resave and Capture baseline now send every counted leaf's status, so staged
approval changes are saved and stamped by the server. The staged changes clear once the save
succeeds and stay staged if it fails. Save as new and Duplicate still send no statuses. While an
older baseline is pinned, the save takes its statuses from the newest save rather than from the
older one on screen.
