---
'@accounter/client': patch
'@accounter/server': patch
---

* **Introduced Client and Contract Management**: Replaced the GreenInvoiceBusiness concept with dedicated Client and Contract entities, enabling more granular management of client relationships and billing agreements.
* **Database Schema Evolution**: Implemented a new migration to rename the businesses_green_invoice_match table to clients and introduced a new clients_contracts table to store contract details.
* **GraphQL API Expansion**: Added new GraphQL modules for contracts and enhanced the financial-entities module with clients resolvers and types, providing a more structured API for client and contract data.
* **Streamlined Monthly Document Generation UI**: Updated the user interface for issuing monthly documents to leverage the new client and contract data, improving the selection process and draft generation.
* **Removed Legacy CSV Functionality**: Deprecated and removed the CSV upload and download features related to monthly document drafts, simplifying the workflow.
