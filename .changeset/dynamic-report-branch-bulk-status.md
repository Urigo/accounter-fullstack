---
'@accounter/client': patch
---

Dynamic report: a branch's accountant status is now a dropdown too. Choosing a status stages it for
every visible financial-entity leaf in the branch's subtree, nested branches included; hidden leaves
are skipped. Branch statuses are disabled under the same rules as leaf statuses.
