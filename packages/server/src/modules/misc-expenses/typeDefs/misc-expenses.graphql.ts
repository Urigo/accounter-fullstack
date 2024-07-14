import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    miscExpensesByCharge(chargeId: UUID!): [MiscExpense!]! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    updateMiscExpense(transactionId: UUID!, fields: UpdateMiscExpenseInput!): MiscExpense!
      @auth(role: ACCOUNTANT)
    insertMiscExpense(fields: InsertMiscExpenseInput!): MiscExpense! @auth(role: ACCOUNTANT)
  }

  " a misc expense  "
  type MiscExpense {
    transaction: Transaction!
    transactionId: UUID!
    charge: Charge!
    counterparty: FinancialEntity!
    amount: FinancialAmount!
    description: String
    date: TimelessDate
  }

  " input variables for updateMiscExpense "
  input UpdateMiscExpenseInput {
    amount: Float
    description: String
    date: TimelessDate
    counterpartyId: UUID
  }

  " input variables for insertMiscExpense "
  input InsertMiscExpenseInput {
    transactionId: UUID!
    amount: Float
    description: String
    date: TimelessDate
    counterpartyId: UUID
  }

  extend interface Charge {
    " list of misc expenses linked to transactions of the charge "
    miscExpenses: [MiscExpense!]!
  }

  extend type BankDepositCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type BusinessTripCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type CommonCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type ConversionCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type CreditcardBankCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type DividendCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type InternalTransferCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type MonthlyVatCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type RevaluationCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type SalaryCharge {
    miscExpenses: [MiscExpense!]!
  }
`;
