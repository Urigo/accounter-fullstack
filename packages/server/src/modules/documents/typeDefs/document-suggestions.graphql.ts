import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend interface FinancialDocument {
    " missing info suggestions data "
    missingInfoSuggestions: DocumentSuggestions
  }

  extend type Invoice {
    missingInfoSuggestions: DocumentSuggestions
  }

  extend type Receipt {
    missingInfoSuggestions: DocumentSuggestions
  }

  extend type InvoiceReceipt {
    missingInfoSuggestions: DocumentSuggestions
  }

  extend type CreditInvoice {
    missingInfoSuggestions: DocumentSuggestions
  }

  extend type Proforma {
    missingInfoSuggestions: DocumentSuggestions
  }

  " represent document suggestions for missing info "
  type DocumentSuggestions {
    " The owner of the document "
    owner: FinancialEntity
    " The counter-side of the document (opposite to it's owner) "
    counterparty: FinancialEntity
    " The document amount "
    amount: FinancialAmount
    " The document direction (income or expense) "
    isIncome: Boolean
  }
`;
