import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    " run all manual automation steps in order. Select its events with @stream to get every change as it happens "
    runManualAutomations: ManualAutomationsRun! @requiresAuth @requiresRole(role: "business_owner")
  }

  " result of a manual automations run (@stream is not allowed on root mutation fields, hence the wrapper) "
  type ManualAutomationsRun {
    " step statuses and changes, in the order they happened "
    events: [ManualAutomationEvent!]!
  }

  " a single manual automations run event: either a step status change or one change made by a step "
  union ManualAutomationEvent =
    | ManualAutomationStepStatus
    | ForeignFeeTransactionFlagged
    | ChargesMergedByReference
    | CreditcardDebitDateFilled
    | CreditcardStatementsLinked
    | DeelChargeSynced

  " manual automation steps, in execution order "
  enum ManualAutomationStep {
    FLAG_FOREIGN_FEES
    MERGE_CHARGES_BY_REFERENCE
    FILL_CREDITCARD_DEBIT_DATES
    LINK_CREDITCARD_STATEMENTS
    FETCH_DEEL_DOCUMENTS
  }

  " manual automation step state "
  enum ManualAutomationStepState {
    RUNNING
    SUCCEEDED
    " the step finished, but some of its items failed (see errors) "
    COMPLETED_WITH_ERRORS
    FAILED
    " not executed, because a previous step failed "
    SKIPPED
    " not executed, because the integration it needs is not set up for this business "
    NOT_CONFIGURED
  }

  " status of a manual automation step. Emitted when a step starts and when it ends "
  type ManualAutomationStepStatus {
    step: ManualAutomationStep!
    state: ManualAutomationStepState!
    " number of changes made by the step, set once the step is done "
    affectedCount: Int
    errors: [String!]
  }

  " a transaction flagged as a fee by the manual automations "
  type ForeignFeeTransactionFlagged {
    transaction: Transaction!
  }

  " charges merged by the manual automations, based on shared transaction reference "
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

  " a credit card transaction whose missing debit date was filled by the manual automations "
  type CreditcardDebitDateFilled {
    transaction: Transaction!
    debitDate: TimelessDate!
  }

  " a bank card debit the manual automations linked to the card statement(s) it settles "
  type CreditcardStatementsLinked {
    bankTransaction: Transaction!
    method: CreditCardStatementLinkMethod!
    statements: [CreditCardStatement!]!
  }

  " a charge that got Deel invoices when the manual automations pulled Deel documents "
  type DeelChargeSynced {
    charge: Charge!
    " true when the charge was created by this run, false when an existing charge was updated "
    isNew: Boolean!
    " number of Deel invoices recorded on the charge by this run "
    invoiceCount: Int!
  }
`;
