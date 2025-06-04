---
'@accounter/shaam6111-generator': patch
'@accounter/client': patch
'@accounter/server': patch
---

- **New Features**
  - Introduced a comprehensive Shaam6111 financial report with multi-tab views for header, profit and loss, tax adjustment, and balance sheet data.
  - Added a new route and sidebar link for accessing the Shaam6111 report.
  - Implemented filter options for selecting business, year, and reference year within the report interface.

- **Improvements**
  - Enhanced forms and queries to support IRS codes for business and tax category data.
  - Updated UI components for more precise type handling.
  - Improved report data fetching with parallel loading of ledger records and financial entities.
  - Added detailed GraphQL schema definitions and resolvers for Shaam6111 reports.
  - Integrated new helper functions for generating Shaam6111 report data.
  - Refactored cumulative calculation logic for research and development expenses in tax reports.
  - Centralized and streamlined validation formulas for profit and loss and balance sheet summaries.

- **Bug Fixes**
  - Adjusted tax adjustment summary validation logic and updated corresponding tests.

- **Documentation**
  - Added detailed GraphQL schema definitions for Shaam6111 reports.

- **Tests**
  - Updated and expanded test cases for tax adjustment and header validation.

- **Chores**
  - Refined internal configuration and export orders for improved maintainability.
  - Added new dependency for Shaam6111 report generation.
