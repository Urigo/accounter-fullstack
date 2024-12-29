import { parse } from 'graphql';

export const typeDefsAccountantApproval = parse(/* GraphQL */ `
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key", "@shareable"])

  type Mutation {
    updateChargeAccountantApproval(
      chargeId: UUID!
      approvalStatus: AccountantStatus!
    ): AccountantStatus! @auth(role: ACCOUNTANT)
    updateBusinessTripAccountantApproval(
      businessTripId: UUID!
      approvalStatus: AccountantStatus!
    ): AccountantStatus! @auth(role: ACCOUNTANT)
  }

  "Base interface for all charge types"
  interface Charge @key(fields: "id") {
    id: UUID!
    "calculated based on ledger record and transaction approvals"
    accountantApproval: AccountantStatus! @shareable
  }

  extend type CommonCharge implements Charge @key(fields: "id") {
    id: UUID!
    accountantApproval: AccountantStatus!
  }

  extend type BusinessTrip @key(fields: "id") {
    id: UUID!
    accountantApproval: AccountantStatus!
  }

  extend type FinancialCharge implements Charge @key(fields: "id") {
    id: UUID!
    accountantApproval: AccountantStatus!
  }

  extend type ConversionCharge implements Charge @key(fields: "id") {
    id: UUID!
    accountantApproval: AccountantStatus!
  }

  extend type SalaryCharge implements Charge @key(fields: "id") {
    id: UUID!
    accountantApproval: AccountantStatus!
  }

  extend type InternalTransferCharge implements Charge @key(fields: "id") {
    id: UUID!
    accountantApproval: AccountantStatus!
  }

  extend type DividendCharge implements Charge @key(fields: "id") {
    id: UUID!
    accountantApproval: AccountantStatus!
  }

  extend type BusinessTripCharge implements Charge @key(fields: "id") {
    id: UUID!
    accountantApproval: AccountantStatus!
  }

  extend type MonthlyVatCharge implements Charge @key(fields: "id") {
    id: UUID!
    accountantApproval: AccountantStatus!
  }

  extend type BankDepositCharge implements Charge @key(fields: "id") {
    id: UUID!
    accountantApproval: AccountantStatus!
  }

  extend type CreditcardBankCharge implements Charge @key(fields: "id") {
    id: UUID!
    accountantApproval: AccountantStatus!
  }

  input UpdateChargeInput {
    accountantApproval: AccountantStatus
  }

  "represents accountant approval status"
  enum AccountantStatus {
    UNAPPROVED
    APPROVED
    PENDING
  }
`);
