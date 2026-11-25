---
'@accounter/server': patch
---

Depreciation engine: after the end year an asset now stays fully depreciated (so writing it off books no loss), the end-year rule also applies when a disposal falls on or after the end date, and disposed costs are rounded to whole shekels cumulatively in date order, so the slices add up to the rounded total and a full disposal lands on the rounded cost (proceeds are kept as given).
