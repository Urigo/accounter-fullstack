---
'@accounter/client': patch
---

The dynamic report CSV export now has a Status column: each leaf row carries its effective approval
status and each branch row its derived status (empty when the branch has no counted leaves). The
CSV row building moved into a tested `buildReportCsv` util; the other columns are unchanged.
