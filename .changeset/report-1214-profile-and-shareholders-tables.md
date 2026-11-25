---
'@accounter/server': patch
---

Form 1214: new `report_1214_profiles` and `shareholders` tables, both with tenant RLS. A profile
holds one owner's form 1214 data for one tax year (company overrides, declarations, preparer, bank
account, related companies, R&D investments, hand-entered amounts), as JSONB in the shapes of
`@accounter/opcn1214-generator`'s input types. Shareholders are stored one row per shareholder per
year, so other reports can reuse them. No API uses the tables yet.
