---
"@accounter/shaam6111-generator": patch
---

New `frameReportFile` / `encodeReportFile`: each record followed by CR LF, the file closed with
X'0D0A1A', at most 10 reports, encoded as Windows-1255, per the SHAAM specification.
`convertReportToFile` frames the record the same way. `isValidIsraeliID` is exported.
