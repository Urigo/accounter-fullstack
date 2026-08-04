---
'@accounter/mcp-server': patch
---

Fix unit tests that broke when the MCP tool limits were raised. Several tests
hardcoded the old caps, so inputs meant to exceed a bound (a wide date range, an
over-cap page size, a full lookup payload) became valid once the limits grew.
The assertions now derive their boundary values from the exported constants
(`MAX_PAGE_SIZE`, `MAX_DATE_RANGE_DAYS`, `MAX_REPORT_DATE_RANGE_DAYS`,
`MAX_FILTERED_CHARGES`), and the byte-budget no-truncation case is pinned to a
row count that genuinely fits the payload budget, so the suite tracks future
limit changes.
