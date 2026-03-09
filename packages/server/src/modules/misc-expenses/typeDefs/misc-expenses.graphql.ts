import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    miscExpensesByCharge(chargeId: UUID!): [MiscExpense!]! @requiresAuth
  }

  extend type Mutation {
    updateMiscExpense(id: UUID!, fields: UpdateMiscExpenseInput!): MiscExpense!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    insertMiscExpense(chargeId: UUID!, fields: InsertMiscExpenseInput!): MiscExpense!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    insertMiscExpenses(chargeId: UUID!, expenses: [InsertMiscExpenseInput!]!): Charge!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    deleteMiscExpense(id: UUID!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
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
    valueDate: DateTime!
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

  extend type FinancialCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type ForeignSecuritiesCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type InternalTransferCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type MonthlyVatCharge {
    miscExpenses: [MiscExpense!]!
  }

  extend type SalaryCharge {
    miscExpenses: [MiscExpense!]!
  }
`;
