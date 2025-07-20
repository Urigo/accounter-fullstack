---
'@accounter/shaam-uniform-format-generator': patch
'@accounter/client': patch
'@accounter/server': patch
---

* **New Client-Side Feature**: I've added a new modal component (`FileDownloadModal`) to the client application, allowing users to select a date range and trigger the generation and download of uniform format files (bkmvdata and ini) directly from the UI.
* **Data Model Extension**: The `JournalEntry` and `BusinessMetadata` schemas have been extended to support additional optional fields, such as `batchNumber`, `transactionType`, `referenceDocument`, `currencyCode`, `foreignCurrencyAmount` for journal entries, and `address` details for business metadata. This enriches the data available for reporting.
* **Uniform Format Generator Enhancement**: The `generateUniformFormatReport` function in the generator package has been updated to consume and incorporate these new extended fields from the `JournalEntry` and `BusinessMetadata` into the generated uniform format files, ensuring more comprehensive reports.
* **Testing**: New unit tests have been added to verify that the uniform format generator correctly handles journal entries with the newly introduced extended fields, ensuring data integrity and proper report generation.
