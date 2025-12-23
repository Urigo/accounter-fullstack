---
'@accounter/client': patch
'@accounter/server': patch
---

- **Business Entity Enrichment**: Added 'city' and 'zipCode' fields to the Business entity across
  the application to provide more detailed address information.
- **Database Schema Update and Cleanup**: A new migration introduces 'city' (VARCHAR(50)) and
  'zip_code' (VARCHAR(15)) columns to the 'businesses' table. Concurrently, numerous deprecated and
  unused columns (e.g., 'password', 'tax_siduri_number_2021', 'wizcloud_token', 'bank_account_IBAN')
  have been removed from the 'businesses' table.
- **UI and API Integration**: The new fields are integrated into various client-side forms (e.g.,
  ContactInfoSection, ClientForm, InsertBusiness modal) and GraphQL types/resolvers for both
  querying and mutating business data.
- **Form Component Refactoring**: The 'insert-business-fields.tsx' and 'modify-business-fields.tsx'
  components were removed, indicating a potential consolidation or simplification of business form
  logic.
