---
'@accounter/client': patch
'@accounter/server': patch
---

- **New Hook for Admin Businesses**: Implemented a new React hook, `useGetAdminBusinesses`, to
  specifically fetch and manage admin business data, replacing the more generic financial entities.
- **VAT Report Filter Update**: Updated the VAT monthly report filters to utilize the new
  `useGetAdminBusinesses` hook and changed the UI label from 'Financial Entities' to 'Report Issuer
  (Admin Business)' for clarity.
- **Conditional Data Fetching**: Modified the VAT monthly report component to pause data fetching
  when no admin business ID (represented by `financialEntityId`) is selected, preventing unnecessary
  queries and potential errors.
- **Server-side Environment Validation**: Added a defensive null check in the server's
  `PubsubServiceProvider` to ensure the Gmail environment configuration is present, throwing an
  explicit error if it's missing.
