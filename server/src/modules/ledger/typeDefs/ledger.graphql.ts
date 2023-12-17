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
    reference2: String
  }

  extend interface Charge {
    " ledger records linked to the charge "
    ledgerRecords: GeneratedLedgerRecords
  }

  extend type CommonCharge {
    ledgerRecords: GeneratedLedgerRecords
  }

  extend type ConversionCharge {
    ledgerRecords: GeneratedLedgerRecords
  }

  extend type SalaryCharge {
    ledgerRecords: GeneratedLedgerRecords
  }

  extend type InternalTransferCharge {
    ledgerRecords: GeneratedLedgerRecords
  }

  extend type DividendCharge {
    ledgerRecords: GeneratedLedgerRecords
  }

  extend type BusinessTripCharge {
    ledgerRecords: GeneratedLedgerRecords
  }

  " unbalanced entity over ledger records "
  type LedgerBalanceUnbalancedEntities {
    entity: Counterparty!
    balance: FinancialAmount!
  }

  " info about ledger total balance "
  type LedgerBalanceInfo {
    isBalanced: Boolean!
    unbalancedEntities: [LedgerBalanceUnbalancedEntities!]!
  }

  " array of ledger records linked to the charge "
  type LedgerRecords {
    records: [LedgerRecord!]!
    balance: LedgerBalanceInfo
  }

  " result type for ledger records "
  union GeneratedLedgerRecords = LedgerRecords | CommonError
`;
