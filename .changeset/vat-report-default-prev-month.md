---
'@accounter/client': patch
---

Default the VAT monthly report to the previous month instead of the current one.

The current month is still ongoing, so its VAT report is always incomplete — opening the screen on
it meant every user's first action was stepping the month picker back one. The report now opens on
the previous month.

The default is shared through a new `getDefaultVatReportMonth` helper in the report's `utils.ts`,
so the initial filter state, the filter modal's "Clear" reset and the month picker's fallback all
resolve to the same month. An explicit month in the `vatMonthlyReportFilters` URL param still wins,
so existing links keep pointing at the month they encode.
