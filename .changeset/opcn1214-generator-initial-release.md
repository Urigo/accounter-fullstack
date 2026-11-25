---
'@accounter/opcn1214-generator': minor
---

New package: generate, validate and parse SHAAM form 1214 (Israeli corporate annual return) OPCN
files for tax years 2024 and 2025. `validate1214` returns every error and warning with a stable rule
ID and input path, `generate1214` writes the windows-1255 file, `generate1214Batch` and
`parse1214Batch` handle OPCN batch files of up to 50 reports, `parse1214` reads a file back into
the typed input, and `parseResponseFile` reads SHAAM's response file (`shumot.shg`). The rule
catalogue is exported as `RULES`.
