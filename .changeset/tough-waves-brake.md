---
'@accounter/client': patch
'@accounter/server': patch
---

- **Frontend Enhancement**: Implemented a new free text search input field within the charges filter
  user interface, allowing users to search for charges using keywords.
- **Database Schema Update**: Introduced a database migration to enhance the `extended_charges` view
  with a `merged_search_text` column, which concatenates various textual fields (user descriptions,
  transaction details, document information) for comprehensive search capabilities.
- **API and Backend Integration**: Extended the GraphQL schema to support a `freeText` filter for
  charges and integrated this filter into the backend charges provider, utilizing the new
  `merged_search_text` column for efficient filtering.
