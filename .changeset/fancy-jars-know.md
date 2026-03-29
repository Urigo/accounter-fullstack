---
'@accounter/client': patch
---

- **URL-based Year Navigation**: Migrated the annual audit flow to use URL parameters for the year,
  enabling direct navigation and bookmarking of specific audit years.
- **UI Component Refactoring**: Replaced the modal-based filter system with a dedicated YearPicker
  component and streamlined the audit flow layout.
- **Step Status Logic**: Implemented automated status calculation for step 7 based on the completion
  of preceding steps (1 and 2) and added smooth scrolling navigation.
- **Data Formatting**: Updated percentage displays in the charges validation step to include two
  decimal places for better precision.
