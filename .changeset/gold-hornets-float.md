---
'@accounter/server': patch
---

- **Database Schema Extension**: A new database migration was added to introduce a
  `recipient_legal_entity_id` column to the `accounter_schema.deel_invoices` table, enhancing data
  capture for legal entities.
- **API Schema Updates for Deel Integration**: The Deel invoice schema was extended to include
  `recipient_legal_entity_id` and `deel_reference`, and the `timezone` field for payment receipts
  was made nullable. Additionally, pagination fields (`next_cursor`, `has_more`, `total_count`) were
  integrated into the API response schema for retrieving payment receipts.
- **Workaround for Contractor-Related Fee Invoices**: A temporary fix was implemented in the Deel
  helper to address an issue where fee invoices with empty contractor unique identifiers were
  causing processing problems, ensuring these specific invoices are now handled correctly.
