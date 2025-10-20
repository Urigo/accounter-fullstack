---
'@accounter/client': patch
'@accounter/server': patch
---

- **Database Schema Update**: Introduced a 'locality' column to the 'user_context' table and
  established foreign key relationships for country codes in both 'user_context' and 'businesses'
  tables, linking them to a 'countries' table.
- **Dynamic Country Selection**: The 'Locality' field in the 'ModifyBusinessFields' component now
  dynamically fetches and displays a list of all countries, replacing previous hardcoded options.
- **User-Contextual Default Country**: New businesses created via the 'InsertBusiness' modal will
  now default their country based on the user's 'locality' from their 'userContext'.
- **Centralized Locality Management**: The 'admin-context' and 'user-context' modules on the
  server-side have been updated to store and retrieve the user's 'locality', ensuring consistent
  access across the application.
- **VAT Logic Enhancement**: VAT validation and deduction logic now utilize the dynamically
  retrieved 'adminContext.locality' instead of a hardcoded country name, improving flexibility and
  accuracy.
