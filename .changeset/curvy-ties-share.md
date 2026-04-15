---
'@accounter/client': patch
---

- **New Annual Audit Steps**: Introduced two new annual audit steps: 'Generate Tax Report' (Step 13)
  and 'Generate Tax Compliance Reports' (Step 14), integrating them into the annual audit flow.
- **Audit Step Refactoring**: Refactored existing annual audit steps (Export Trial Balance and
  Depreciation Report) and the newly added steps to use a new generic `StepWithLink` component and a
  `useAnnualAuditStep` custom hook. This significantly reduces code duplication and centralizes
  status management logic for audit steps.
- **PDF Export Functionality**: Added 'Print to PDF' buttons to the Corporate Tax Ruling Compliance
  Report and Tax Report pages, allowing users to easily export these reports.
