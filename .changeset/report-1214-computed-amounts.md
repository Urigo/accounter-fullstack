---
'@accounter/server': minor
---

Fill in form 1214 record 1000 amounts that Accounter can compute, under the profile's overrides.
`report1214` gains an `amounts` field: one row per code of the report, sorted by code, with the
amount used, its `source` (`COMPUTED` or `OVERRIDE`), the computed amount (also when an override
replaces it) and the code's Hebrew name for computed codes. Only codes whose meaning the SHAAM
layout specification states and that Accounter holds exactly are computed; for now that is code 165,
the total of the R&D investments stored in the 1214 profile. Every other code, including the
required ones, still comes from the profile's amount overrides. An override wins whenever it is
set, so an override of 0 replaces the computed amount. Codes computed from the books are only
computed for the active business and a supported tax year; otherwise, or when the tax computation
fails, the report carries an `accounter.amounts.computationSkipped` / `computationFailed` warning
and uses the overrides alone.
