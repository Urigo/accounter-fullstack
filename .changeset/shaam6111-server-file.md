---
"@accounter/server": patch
---

SHAAM 6111 report: the file can be produced. It holds only the non-zero lines and the mandatory
totals (a section takes 150 lines; the report used to emit every code and always failed
validation), framed and Windows-1255 encoded (`Shaam6111File.encodedContent`, file name
`DKASPI.DAT`). New `Shaam6111Report.validation` runs the SHAAM rules; `file` fails with a clear
error while there are blocking issues.
