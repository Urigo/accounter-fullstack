import { gql } from 'graphql-modules';

export const chargesMutationsSchema = gql`
  extend type Mutation {
    updateCharge(chargeId: ID!, fields: UpdateChargeInput!): UpdateChargeResult!
    updateTransaction(transactionId: ID!, fields: UpdateTransactionInput!): UpdateTransactionResult!
  }

  " input variables for updateCharge "
  input UpdateChargeInput {
    # createdAt: Date!
    # additionalDocument: [Linkable!]!
    # ledgerRecords: [LedgerRecord!]!
    # transactions: [Transaction!]!

    counterparty: CounterpartyInput
    # description: String

    tags: [TagInput!]
    beneficiaries: [BeneficiaryInput!]
    vat: Float
    withholdingTax: Float
    totalAmount: FinancialAmountInput
    # invoice: Invoice

    accountantApproval: AccountantApprovalInput
    isProperty: Boolean
    # businessTrip: BusinessTrip
  }

  " input variables for updateTransaction "
  input UpdateTransactionInput {
    referenceNumber: String
    # createdAt: Date!

    effectiveDate: TimelessDate
    # direction: TransactionDirection

    amount: FinancialAmountInput
    # description: String // NOTE: which field should be updated? and should we update fields originated at bank/card info?

    userNote: String
    # account: FinancialAccount

    balance: FinancialAmountInput
    hashavshevetId: Int
  }

  " result type for updateCharge "
  union UpdateChargeResult = Charge | CommonError

  " result type for updateTransaction "
  union UpdateTransactionResult = CommonTransaction | CommonError # TODO: update to match more than common transaction
  " input variables for Tag"
  input TagInput {
    name: String!
  }

  " input variables for beneficiary"
  input BeneficiaryInput {
    counterparty: CounterpartyInput!
    percentage: Percentage!
  }

  " input variables for updateCharge.Counterparty"
  input CounterpartyInput {
    name: String!
  }
`;
