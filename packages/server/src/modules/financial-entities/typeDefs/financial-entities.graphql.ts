import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    financialEntity(id: UUID!): FinancialEntity! @auth(role: ACCOUNTANT)
    " TODO: This is temporary, should be replaced after auth and financial entities hierarchy is implemented "
    allFinancialEntities(page: Int, limit: Int): PaginatedFinancialEntities @auth(role: ACCOUNTANT)
  }

  " response for paginated Financial Entities "
  type PaginatedFinancialEntities {
    nodes: [FinancialEntity!]!
    pageInfo: PageInfo!
  }

  " represent a financial entity of any type, including businesses, tax categories, etc. "
  interface FinancialEntity {
    id: UUID!
    name: String!
  }

  extend interface Charge {
    " calculated counterparty details for the charge "
    counterparty: FinancialEntity
  }

  extend type CommonCharge {
    counterparty: FinancialEntity
  }

  extend type ConversionCharge {
    counterparty: FinancialEntity
  }

  extend type SalaryCharge {
    counterparty: FinancialEntity
  }

  extend type InternalTransferCharge {
    counterparty: FinancialEntity
  }

  extend type DividendCharge {
    counterparty: FinancialEntity
  }

  extend type BusinessTripCharge {
    counterparty: FinancialEntity
  }

  extend type MonthlyVatCharge {
    counterparty: FinancialEntity
  }

  extend input UpdateChargeInput {
    counterpartyId: UUID
    ownerId: UUID
  }

  extend interface Transaction {
    " calculated counterparty details for the charge "
    counterparty: FinancialEntity
  }
  extend type CommonTransaction {
    counterparty: FinancialEntity
  }

  extend type WireTransaction {
    counterparty: FinancialEntity
  }

  extend type FeeTransaction {
    counterparty: FinancialEntity
  }

  extend type ConversionTransaction {
    counterparty: FinancialEntity
  }

  extend interface Document {
    creditor: FinancialEntity
    debtor: FinancialEntity
  }

  extend interface FinancialDocument {
    creditor: FinancialEntity
    debtor: FinancialEntity
  }

  extend type Unprocessed {
    creditor: FinancialEntity
    debtor: FinancialEntity
  }

  extend type Invoice {
    creditor: FinancialEntity
    debtor: FinancialEntity
  }

  extend type Proforma {
    creditor: FinancialEntity
    debtor: FinancialEntity
  }

  extend type Receipt {
    creditor: FinancialEntity
    debtor: FinancialEntity
  }

  extend type InvoiceReceipt {
    creditor: FinancialEntity
    debtor: FinancialEntity
  }

  extend type CreditInvoice {
    creditor: FinancialEntity
    debtor: FinancialEntity
  }

  extend type LedgerRecord {
    debitAccount1: FinancialEntity
    debitAccount2: FinancialEntity
    creditAccount1: FinancialEntity
    creditAccount2: FinancialEntity
  }
`;
