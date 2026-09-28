---
'@accounter/server': minor
'@accounter/client': minor
---

Cron jobs now run from a dedicated screen (`/charges/cron-jobs`, linked from the user menu) that
lists what each job changed, as it happens: transactions flagged as fees, charges merged by
transaction reference (with links to the kept charge), and credit card debit dates filled.

Server: new `runCronJobs` mutation that runs the three jobs in order and streams an event per
change (`runCronJobs { events @stream }`). `mergeChargesByTransactionReference`,
`flagForeignFeeTransactions` and `calculateCreditcardTransactionsDebitDate` are deprecated in its
favor.
