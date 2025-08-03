---
'@accounter/server': patch
---

* **Refactored Invoice Filtering**: The `fetchAndFilterInvoices` helper function in `deel.helper.ts` has been streamlined. It now exclusively identifies and returns Deel invoices that are *not* yet present in the database, removing the previous logic for tracking 'known' receipt IDs. This simplifies its responsibility to only provide new invoices for processing.
* **Improved Receipt-Charge Matching Efficiency**: A new, optimized database query (`getReceiptToCharge`) has been introduced in `deel-invoices.provider.ts`. This query efficiently retrieves all existing Deel receipt-to-charge mappings directly from the database, ensuring that for each payment ID, the most recent associated charge ID is fetched.
* **Streamlined Charge Matching Logic**: The `getChargeMatchesForPayments` helper function in `deel.helper.ts` has been updated to leverage the new `getReceiptToCharge` method from `DeelInvoicesProvider`. This change eliminates the need to pass an intermediate `knownReceiptIds` set and perform individual lookups, leading to a more direct and efficient matching process.
