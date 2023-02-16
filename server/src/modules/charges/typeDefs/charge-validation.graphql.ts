import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Charge {
    " missing info validation data "
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
    TRANSACTION_DESCRIPTION
    TAGS
    VAT
    DOCUMENTS
    LEDGER_RECORDS
    BALANCE
  }

  extend input ChargeFilter {
    " Include only charges that doesn't have transactions linked "
    withoutTransaction: Boolean
    " Include only charges that doesn't have Ledger records linked "
    withoutLedger: Boolean
    " Include only charges that doesn't have documents linked "
    withoutDocuments: Boolean
    " Include only charges that doesn't have invoice document linked "
    withoutInvoice: Boolean
    " Include only charges that are not balances "
    unbalanced: Boolean
  }
`;
