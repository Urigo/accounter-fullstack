---
'@accounter/shaam6111-generator': minor
---

New `frameReportFile` / `encodeReportFile`: each record followed by CR LF, the file closed with
X'0D0A1A', at most 10 reports of exactly 8612 characters each, encoded as Windows-1255, per the
SHAAM specification. `convertReportToFile` now writes the framed file (8615 bytes for one report
instead of the bare 8612-byte record). `isValidIsraeliID` and `REPORT_RECORD_LENGTH` are exported.
