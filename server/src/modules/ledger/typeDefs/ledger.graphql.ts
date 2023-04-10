import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  " represent atomic movement of funds "
  type LedgerRecord {
    id: ID!
    debitAmount1: FinancialAmount
    debitAmount2: FinancialAmount
    creditAmount1: FinancialAmount
    creditAmount2: FinancialAmount
    localCurrencyDebitAmount1: FinancialAmount!
    localCurrencyDebitAmount2: FinancialAmount
    localCurrencyCreditAmount1: FinancialAmount!
    localCurrencyCreditAmount2: FinancialAmount
    invoiceDate: Date!
    valueDate: Date!
    description: String
    reference1: String
    debitAccount1: LedgerCounterparty!
    debitAccount2: LedgerCounterparty
    creditAccount1: LedgerCounterparty!
    creditAccount2: LedgerCounterparty
  }

  " represents ledger record counterparty OR tax category"
  union LedgerCounterparty = NamedCounterparty | TaxCategory

  extend type Charge {
    " ledger records linked to the charge "
    ledgerRecords: GeneratedLedgerRecords
  }

  " array of ledger records linked to the charge "
  type LedgerRecords {
    records: [LedgerRecord!]!
  }

  " result type for ledger records "
  union GeneratedLedgerRecords = LedgerRecords | CommonError
`;
