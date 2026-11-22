---
'@accounter/server': patch
---

Add a depreciation engine that models asset disposals (sale, cost refund, write-off): disposal-year
depreciation is pro-rated to the disposal date, and each disposal gets its slice of accumulated
depreciation, net book value and gain or loss. Assets without disposals compute exactly as before.
