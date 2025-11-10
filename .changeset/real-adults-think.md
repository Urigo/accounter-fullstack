---
'@accounter/client': patch
'@accounter/server': patch
---

- **New 'Accounts' Section in Admin Business View**: A dedicated tab named 'Accounts' has been added
  to the admin business page, allowing administrators to manage financial accounts associated with a
  business.
- **Comprehensive Financial Account Management**: The new section introduces functionality to view,
  create, and edit various types of financial accounts, including bank accounts, credit cards,
  crypto wallets, bank deposit accounts, and foreign securities accounts. This includes a modal for
  modifying account details.
- **Extended Bank Account Details**: Bank accounts can now store a wide array of specific
  information such as extended bank numbers, party preferred indications, account involvement codes,
  various dates (deal, update, agreement opening), and other descriptive fields like service
  authorization and product labels.
- **Dynamic Currency and Tax Category Handling**: Financial accounts now support multiple
  currencies, each linked to its own tax category. The UI allows for dynamic addition and removal of
  these currency-tax category pairs during account creation or editing.
- **Backend CRUD Operations for Financial Accounts**: New GraphQL queries and mutations have been
  implemented on the server-side to support full Create, Read, Update, and Delete (CRUD) operations
  for financial accounts, including fetching accounts by owner and by ID.
- **Database Migration for Account Name**: A new database migration has been added to introduce an
  `account_name` column to the `financial_accounts` table, providing more flexibility for account
  naming.
