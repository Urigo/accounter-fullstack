---
'@accounter/client': patch
'@accounter/server': patch
---

- **Opening Balance Step Activation**: Implemented the logic and UI for the 'Opening Balance' step
  in the annual audit flow, including user type classification (New, Migrating, Continuing).
- **Backend Integration**: Added a new GraphQL query to fetch the opening balance status and a
  mutation to save accountant approvals for this step.
- **UI Components**: Introduced new UI components, including an 'ApprovalControl' for status updates
  and an 'Alert' component for displaying configuration or status information.
