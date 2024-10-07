import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    miscExpensesByCharge(chargeId: UUID!): [MiscExpense!]! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    updateMiscExpense(id: UUID!, fields: UpdateMiscExpenseInput!): MiscExpense!
      @auth(role: ACCOUNTANT)
    insertMiscExpense(fields: InsertMiscExpenseInput!): MiscExpense! @auth(role: ACCOUNTANT)
    deleteMiscExpense(id: UUID!): Boolean! @auth(role: ACCOUNTANT)
  }

  " a misc expense  "
  type MiscExpense {
    id: UUID!
    charge: Charge!
    chargeId: UUID!
    creditor: FinancialEntity!
    debtor: FinancialEntity!
    amount: FinancialAmount!
    description: String
    valueDate: TimelessDate!
    invoiceDate: TimelessDate!
  }

  " input variables for updateMiscExpense "
  input UpdateMiscExpenseInput {
    chargeId: UUID
    creditorId: UUID
    debtorId: UUID
    amount: Float
    currency: Currency
    description: String
    valueDate: DateTime
    invoiceDate: TimelessDate
  }

  " input variables for insertMiscExpense "
  input InsertMiscExpenseInput {
    chargeId: UUID!
    creditorId: UUID!
    debtorId: UUID!
    amount: Float!
    currency: Currency!
    description: String
    valueDate: DateTime!
    invoiceDate: TimelessDate!
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

  extend type FinancialCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type SalaryCharge {
    miscExpenses: [MiscExpense!]!
  }
`;
