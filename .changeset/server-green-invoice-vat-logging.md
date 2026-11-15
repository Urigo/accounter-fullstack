---
'@accounter/server': patch
---

Green Invoice and VAT-report failures logged once, with the reason (closes #4872).

- A failed Green Invoice call logs one `green-invoice-call-failed` line with the SDK call
  (`greenInvoiceCall`), the upstream HTTP status, Green Invoice's own error code and message (never
  the response body) and the operation's request ID. The thrown error includes that message, so a
  failed client update tells the user why. The message has digit runs and emails masked and is
  capped at 200 characters.
- A failed Green Invoice document import no longer puts the whole document (client details,
  amounts) in its error message; it names the document ID.
- The VAT report logs a VAT amount that doesn't match the VAT rate at `info`, as a data-quality
  finding, and no longer logs and rethrows every record error. A failed VAT report logs one
  `vat-report-records-failed` line (`warn`) listing every failing document, instead of a multi-line
  `console.error` with only the first.
