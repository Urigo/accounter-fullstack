---
'@accounter/client': patch
'@accounter/server': patch
---

- **New Feature: Foreign Securities Charges**: Comprehensive support for 'Foreign Securities
  Charges' has been introduced across the application. This includes new database fields, GraphQL
  types, frontend UI components, and backend resolvers to correctly categorize, display, and process
  these charges.
- **Module Refactoring and Enhancements: Bank Deposits**: A new dedicated GraphQL module for 'Bank
  Deposits' has been created, along with new UI components to display bank deposit information,
  including balances and associated transactions. This refactors existing bank deposit logic into a
  more organized structure.
- **Enhanced Ledger Generation for Foreign Securities**: Advanced ledger generation logic has been
  implemented specifically for 'Foreign Securities Charges'. This new resolver handles complex
  scenarios involving main transactions, associated fees, and currency exchange rates to ensure
  accurate financial record-keeping.
- **Admin Context Configuration for Foreign Securities**: The application's administrative context
  has been updated to include configuration for foreign securities, allowing for the definition of
  specific business and fees categories related to these charges.
- **System-Wide Integration of New Charge Type**: Various frontend and backend components have been
  updated to recognize and correctly handle the new 'ForeignSecuritiesCharge' type, ensuring proper
  display, validation, and integration with existing features like accountant approval, documents,
  and tags.
