---
'@accounter/client': patch
'@accounter/server': patch
---

- **Account Filtering for Balance Report**: The 'Transactions Balance' report now supports filtering
  by financial accounts, allowing users to include or exclude specific accounts from the report.
- **Frontend UI Enhancements**: The balance report filter form has been updated with new account
  selection fields, improved form validation using Zod, and UI component adjustments for better
  responsiveness.
- **Backend GraphQL Integration**: The GraphQL schema and resolvers have been extended to include
  financial account data for transactions and to support the new account-based filtering logic.
- **Reusable Account Fetching Logic**: A new helper function and a client-side hook were introduced
  to centralize and streamline the fetching and management of financial account data.
