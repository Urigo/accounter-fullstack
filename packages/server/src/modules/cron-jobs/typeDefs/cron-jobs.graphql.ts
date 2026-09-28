import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    " run all cron jobs in order. Select its events with @stream to get every change as it happens "
    runCronJobs: CronJobsRun! @requiresAuth @requiresRole(role: "business_owner")
    mergeChargesByTransactionReference(
      dryRun: Boolean = true
    ): MergeChargesByTransactionReferenceResult!
      @requiresAuth
      @requiresRole(role: "business_owner")
      @deprecated(reason: "Use runCronJobs")
    flagForeignFeeTransactions: FlagForeignFeeTransactionsResult!
      @requiresAuth
      @requiresRole(role: "business_owner")
      @deprecated(reason: "Use runCronJobs")
    calculateCreditcardTransactionsDebitDate: Boolean!
      @requiresAuth
      @requiresRole(role: "business_owner")
      @deprecated(reason: "Use runCronJobs")
  }

  " result type for mergeChargesByTransactionReference "
  type MergeChargesByTransactionReferenceResult {
    success: Boolean!
    charges: [Charge!]
    plannedMerges: [MergeChargesByTransactionReferencePlan!]
    errors: [String!]
  }

  " planned merge operation for mergeChargesByTransactionReference "
  type MergeChargesByTransactionReferencePlan {
    reference: String!
    baseChargeId: UUID!
    chargeIdsToMerge: [UUID!]!
  }

  " result type for flagForeignFeeTransactions "
  type FlagForeignFeeTransactionsResult {
    success: Boolean!
    transactions: [Transaction!]
    errors: [String!]
  }

  " result of a cron jobs run (@stream is not allowed on root mutation fields, hence the wrapper) "
  type CronJobsRun {
    " step statuses and changes, in the order they happened "
    events: [CronJobEvent!]!
  }

  " a single cron jobs run event: either a step status change or one change made by a step "
  union CronJobEvent =
    | CronJobStepStatus
    | ForeignFeeTransactionFlagged
    | ChargesMergedByReference
    | CreditcardDebitDateFilled

  " cron jobs steps, in execution order "
  enum CronJobStep {
    FLAG_FOREIGN_FEES
    MERGE_CHARGES_BY_REFERENCE
    FILL_CREDITCARD_DEBIT_DATES
  }

  " cron job step state "
  enum CronJobStepState {
    RUNNING
    SUCCEEDED
    " the step finished, but some of its items failed (see errors) "
    COMPLETED_WITH_ERRORS
    FAILED
    " not executed, because a previous step failed "
    SKIPPED
  }

  " status of a cron job step. Emitted when a step starts and when it ends "
  type CronJobStepStatus {
    step: CronJobStep!
    state: CronJobStepState!
    " number of changes made by the step, set once the step is done "
    affectedCount: Int
    errors: [String!]
  }

  " a transaction flagged as a fee by the cron jobs "
  type ForeignFeeTransactionFlagged {
    transaction: Transaction!
  }

  " charges merged by the cron jobs, based on shared transaction reference "
  type ChargesMergedByReference {
    reference: String!
    " the charge that was kept, and now holds the merged charges' data "
    baseCharge: Charge!
    " snapshot of the merged charges, taken before merge. These charges no longer exist "
    mergedCharges: [MergedChargeSnapshot!]!
  }

  " snapshot of a charge that was merged into another charge (and deleted) "
  type MergedChargeSnapshot {
    id: UUID!
    description: String
    " earliest event date of the charge's matched transactions "
    date: TimelessDate
    " total amount of the charge's matched transactions, if they share a single currency "
    amount: FinancialAmount
  }

  " a credit card transaction whose missing debit date was filled by the cron jobs "
  type CreditcardDebitDateFilled {
    transaction: Transaction!
    debitDate: TimelessDate!
  }
`;
