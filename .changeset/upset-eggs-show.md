---
'@accounter/client': patch
'@accounter/server': patch
---

- **Schema updates**: Added `sortCode: Int` field to the `DynamicReportNodeData` GraphQL type and Zod validation schema
- **GraphQL query**: Updated the dynamic report query to fetch the `sortCode` field from template data
- **Tests**: Added comprehensive test coverage for parsing and validating sort-code-branch nodes with sortCode fields, plus a test verifying sortCode is read from template data (not derived from UUID IDs)
