---
'@accounter/server': minor
'@accounter/client': patch
---

**Breaking:** the server's cron-jobs API is renamed to match the Manual Automations screen, since
nothing schedules these jobs. The `runCronJobs` mutation is now `runManualAutomations`, and its
types are renamed: `CronJobsRun` → `ManualAutomationsRun`, `CronJobEvent` →
`ManualAutomationEvent`, `CronJobStep` → `ManualAutomationStep`, `CronJobStepState` →
`ManualAutomationStepState` and `CronJobStepStatus` → `ManualAutomationStepStatus`. The server
module moves from `cron-jobs` to `manual-automations`.

The deprecated `mergeChargesByTransactionReference`, `flagForeignFeeTransactions` and
`calculateCreditcardTransactionsDebitDate` mutations are removed, together with the
`MergeChargesByTransactionReferenceResult`, `MergeChargesByTransactionReferencePlan` and
`FlagForeignFeeTransactionsResult` types. Use `runManualAutomations` instead.
`fetchDeelDocuments` stays (deprecated), as the only way for an accountant to pull Deel documents.
