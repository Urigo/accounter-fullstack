---
'@accounter/server': patch
'@accounter/client': patch
---

Add a "Pull Deel Documents" button to the user nav menu, next to "Add Balance Charge", that triggers
the `fetchDeelDocuments` mutation on demand.

Also improves the underlying Deel invoice fetch/matching logic:

- Distinguishes newly-seen invoices from previously-fetched invoices that are still unmatched, so a
  later run can pick up a payment match for an invoice it already recorded (via a new
  `updateDeelInvoiceRecords` update path) instead of only ever inserting.
- Reuses an already-matched charge for a given receipt when creating charges from payment
  breakdowns, avoiding duplicate charges for invoices that share a receipt.
- Extends the Deel invoice schema/table with `billing_type` and `document_type`, and refines several
  payment-receipt and payment-breakdown Zod schemas to match the Deel API more closely.
