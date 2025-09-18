---
'@accounter/client': patch
'@accounter/server': patch
---

- **Batch Transaction Update API**: Introduced a new GraphQL mutation, `updateTransactions`,
  allowing multiple transactions to be updated in a single API call. This mutation accepts an array
  of transaction IDs and the fields to update.
- **Client-Side Hook for Batch Updates**: A new React hook, `useUpdateTransactions`, has been added
  to facilitate client-side consumption of the batch update functionality, complete with loading,
  success, and error state notifications.
- **Backend Logic for Batch Updates**: Implemented a new SQL query and a corresponding provider
  method to efficiently handle batch updates on the `transactions` table. The existing single
  transaction update method was refactored to utilize this new batch mechanism.
- **UI Integration**: The `similar-transactions-modal` component was updated to leverage the new
  `useUpdateTransactions` hook, enabling users to approve and update multiple similar transactions
  with a single action, improving user experience and reducing server load.
