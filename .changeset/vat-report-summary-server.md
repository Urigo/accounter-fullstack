---
'@accounter/server': minor
---

Add `VatReportResult.summary`, the monthly VAT totals as filed in the PCN874 header.

Until now the VAT report's totals existed only on the client, as a reduction over the report rows
whose definitions differ from the PCN874 file: taxable sales included zero-VAT rows, "equipment
inputs" was a pre-VAT amount where the file reports VAT, and other inputs VAT and the record counts
were not computed at all. Any other consumer (the MCP connector, API users) would have had to
re-implement that logic, and would still disagree with what was filed.

The new `summary: VatReportSummary!` field mirrors the PCN874 header: `taxableSalesAmount`,
`taxableSalesVat`, `salesRecordCount`, `zeroValOrExemptSalesAmount`, `otherInputsVat`,
`equipmentInputsVat`, `inputsCount` and `totalVat`, amounts as `FinancialAmount` in the local
currency. It goes through the PCN874 path itself rather than a parallel implementation: the header
totals are factored out of `getHeaderDataFromRecords` into `getPcn874Totals`, which no longer needs a
licensed dealer id, and both the file header and the summary are built from it over the records
`transactionsFromVatReportRecords` produces.

The summary is the filed figure, so it always covers the whole month and ignores the `chargesType`
filter. When the report is requested without one, its own income and expenses already are that
month and are reused; when it is filtered, the month is fetched again exactly as `getPcn874String`
fetches it. It is a lazy field resolver, so queries that do not select `summary` pay nothing for it.

The totals carry over the header's current coverage: entry types it does not handle yet (for example
`S2`, `Y` and `R`) are left out of the summary just as they are left out of the file.

Fixed along the way: the VAT report and the PCN874 file parsed the requested month with
`new Date(monthDate)`, which reads a date-only string as UTC midnight. On a server west of UTC that
is the previous local day, so a first-of-month request covered the month before, and the PCN874
file could even be stamped with the previous month. The month is now read from the date string's
year and month (`vatReportMonthStart`), for the report's date range, its VAT-date-override bounds,
and the PCN874 file. Servers at UTC or east of it are unaffected.
