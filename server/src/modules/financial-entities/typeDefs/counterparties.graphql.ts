import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  " The other side of a transaction "
  interface Counterparty {
    name: String!
    id: UUID!
  }

  " input variables for updateCharge.Counterparty"
  input CounterpartyInput {
    id: UUID!
  }

  " defines a link between a counterparty and their part in the charge "
  type BeneficiaryCounterparty {
    counterparty: Counterparty!
    percentage: Percentage!
  }

  " represent a counterparty with a name "
  type NamedCounterparty implements Counterparty {
    name: String!
    id: UUID!
  }

  extend interface Charge {
    " calculated counterparty details for the charge "
    counterparty: Counterparty
  }

  extend type CommonCharge {
    counterparty: Counterparty
  }

  extend type ConversionCharge {
    counterparty: Counterparty
  }

  extend type SalaryCharge {
    counterparty: Counterparty
  }

  extend input UpdateChargeInput {
    counterpartyId: UUID
    ownerId: UUID
  }

  extend interface Transaction {
    " calculated counterparty details for the charge "
    counterparty: Counterparty
  }
  extend type CommonTransaction {
    counterparty: Counterparty
  }

  extend type WireTransaction {
    counterparty: Counterparty
  }

  extend type FeeTransaction {
    counterparty: Counterparty
  }

  extend type ConversionTransaction {
    counterparty: Counterparty
  }

  extend interface Document {
    creditor: Counterparty
    debtor: Counterparty
  }

  extend interface FinancialDocument {
    creditor: Counterparty
    debtor: Counterparty
  }

  extend type Unprocessed {
    creditor: Counterparty
    debtor: Counterparty
  }

  extend type Invoice {
    creditor: Counterparty
    debtor: Counterparty
  }

  extend type Proforma {
    creditor: Counterparty
    debtor: Counterparty
  }

  extend type Receipt {
    creditor: Counterparty
    debtor: Counterparty
  }

  extend type InvoiceReceipt {
    creditor: Counterparty
    debtor: Counterparty
  }

  extend type CreditInvoice {
    creditor: Counterparty
    debtor: Counterparty
  }

  extend type LedgerRecord {
    debitAccount1: Counterparty
    debitAccount2: Counterparty
    creditAccount1: Counterparty!
    creditAccount2: Counterparty
  }
`;
