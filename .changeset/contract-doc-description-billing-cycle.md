---
'@accounter/server': patch
---

Contract-generated document descriptions now reflect the billing cycle: monthly contracts keep the
billed-month label (`… - May 2026`), while annual contracts use the contract's start & end dates
(`… January 15th, 2025 → January 14th, 2026`). Also parse `issueMonth` as local midnight to avoid an
off-by-one-month shift in timezones west of UTC.
