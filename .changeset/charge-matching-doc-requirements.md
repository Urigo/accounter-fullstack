---
"@accounter/server": patch
---

Exclude charge types that never require document matching from the
awaiting-match queue. Only COMMON, BUSINESS_TRIP and untyped charges (which
resolve to one of those) are expected to hold both documents and transactions;
BANK_DEPOSIT, CREDITCARD_BANK, DIVIDEND, FOREIGN_SECURITIES, INTERNAL, VAT,
PAYROLL, CONVERSION and FINANCIAL charges are now skipped.
