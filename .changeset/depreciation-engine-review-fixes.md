---
'@accounter/server': patch
---

Depreciation engine: after the end year an asset now stays fully depreciated (so writing it off books no loss), the end-year rule also applies when a disposal falls on or after the end date, and disposed cost is rounded to whole shekels like the asset's cost (proceeds are kept as given).
