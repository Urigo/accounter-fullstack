---
'@accounter/modern-poalim-scraper': patch
'@accounter/scraper-app': patch
'@accounter/server': patch
---

Store the document type code of Poalim SWIFT transfers. Poalim now sends an integer
`documentTypeCode` on every SWIFT item instead of `null`, which failed the scraper's schema
validation and stopped the Poalim scrape. The scraper now requires the field, the scraper app sends
it as `PoalimSwiftTransactionInput.documentTypeCode`, and the server stores it in the new
`poalim_swift_account_transactions.document_type_code` column. A code that differs from the stored
one is reported as a changed field. Deploy the server before the scraper app: an older server
rejects the new input field.
