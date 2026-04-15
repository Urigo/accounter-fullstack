---
'@accounter/client': patch
'@accounter/server': patch
---

- **New Annual Audit Steps**: Implemented Step 10 (Export Trial Balance) and Step 11 (Depreciation
  Report) into the annual audit workflow.
- **Shared Logic Abstraction**: Introduced a reusable hook `useSetAnnualAuditStepStatus` to
  centralize status update logic and added utility functions for depreciation report filters.
- **Enhanced Reporting**: Added PDF printing capabilities to the depreciation report and updated
  routing to support dynamic filter parameters.
