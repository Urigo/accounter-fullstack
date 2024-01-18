import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  " represent other side of a transaction "
  type NamedCounterparty implements FinancialEntity {
    name: String!
    id: UUID!
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
