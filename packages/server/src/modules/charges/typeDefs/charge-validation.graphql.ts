import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend interface Charge {
    " missing info validation data "
    validationData: ValidationData
  }

  extend type CommonCharge {
    validationData: ValidationData
  }

  extend type ConversionCharge {
    validationData: ValidationData
  }

  extend type SalaryCharge {
    validationData: ValidationData
  }

  extend type InternalTransferCharge {
    validationData: ValidationData
  }

  extend type DividendCharge {
    validationData: ValidationData
  }

  extend type BusinessTripCharge {
    validationData: ValidationData
  }

  extend type MonthlyVatCharge {
    validationData: ValidationData
  }

  extend type BankDepositCharge {
    validationData: ValidationData
  }

  extend type CreditcardBankCharge {
    validationData: ValidationData
  }

  " represent a validation data for missing info "
  type ValidationData {
    isValid: Boolean!
    balance: FinancialAmount
    missingInfo: [MissingChargeInfo!]!
  }

  " represent a missing info attributes for a charge"
  enum MissingChargeInfo {
    COUNTERPARTY
    DESCRIPTION
    DOCUMENTS
    TAGS
    TRANSACTIONS
    VAT
    TAX_CATEGORY
  }

  extend input ChargeFilter {
    " Include only charges that doesn't have transactions linked "
    withoutTransaction: Boolean
    " Include only charges that doesn't have documents linked "
    withoutDocuments: Boolean
    " Include only charges that doesn't have invoice document linked "
    withoutInvoice: Boolean
    " Include only charges that are not balances "
    unbalanced: Boolean
    " Include only charges that doesn't have ledger records linked "
    withoutLedger: Boolean
  }
`;
