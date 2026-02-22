---
'@accounter/server': patch
---

- **Owner ID Integration**: The `owner_id` field has been added to both miscellaneous expenses and
  salary records to ensure proper ownership tracking for financial entries.
- **Salary Record Upload Refinements**: The process for uploading salary records from files has been
  made more robust, including improved data validation and more reliable handling of associated
  charges.
- **Data Validation Enhancement**: Null checks in salary data parsing functions were updated to
  explicitly differentiate between `null` and `undefined` values, preventing potential errors during
  file processing.
