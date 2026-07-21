---
"@accounter/client": patch
---

Add optional CSV export to the new charges table. When enabled, a download button on the All Charges
and VAT report missing-info screens exports the currently loaded charges to CSV via a dedicated
`ChargeForCsvExportFields` fragment and `convertChargesToCsv` serializer. The shared
`DownloadCSVButton` now tracks a loading state, disables itself and shows a spinner while the export
file is being prepared, so slow exports can no longer be re-triggered mid-download.
