---
'@accounter/server': patch
---

Depreciation engine: cost refunds are now cost corrections, not partial sales. A refund from activation (the default) reduces the cost from activation, keeps earlier years as filed and recaptures the depreciation booked on the refunded part in the refund year; a refund from the refund date lowers the book value, with income only above it. Sales and write-offs are unchanged. Depreciation now ends on activation + 100/rate years − 1 day, computed in TypeScript instead of SQL (fractional lives add the remaining fraction of 365 days), and 0% categories are supported as assets that are never depreciated.
