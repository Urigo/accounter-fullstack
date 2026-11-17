---
'@accounter/shaam6111-generator': patch
---

Align with the 2025 Form 6111 and the SHAAM file specification:

- Correct the Hebrew labels of P&L codes 2030-2085, 3020-3120 and 3600-3632, which were shifted
  one row from the form (e.g. "כיבודים, מתנות, תרומות, קנסות" is 3625, not 3620), and fix the
  word order of several tax-adjustment labels.
- Code 370 subtracts 184 (investment in a qualifying company), as the specification requires.
- New `frameReportFile` / `encodeReportFile`: each record followed by CR LF, the file closed with
  X'0D0A1A', at most 10 reports, encoded as Windows-1255. `convertReportToFile` now frames the
  record the same way.
- `isValidIsraeliID` is exported.
