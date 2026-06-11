---
'@accounter/shaam-uniform-format-generator': patch
---

- **Data Parsing Refactoring**: Centralized the data file parsing logic into a dedicated
  `parseDataFile` utility, improving code modularity and maintainability.
- **Type Safety Improvements**: Introduced `ParsedDataRecords` interface to standardize data record
  structures and removed redundant manual property mapping.
- **Error Handling Enhancements**: Implemented robust error handling for date conversions and record
  parsing, including better reporting of line numbers and unknown record types.
- **Validation Logic Updates**: Renamed validation functions to `performRecordsValidation` and
  `performCrossFileValidation` for better clarity and intent.
