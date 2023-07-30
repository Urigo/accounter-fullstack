import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Invoice {
    " missing info suggestions data "
    missingInfoSuggestions: DocumentSuggestions
  }

  extend type Receipt {
    " missing info suggestions data "
    missingInfoSuggestions: DocumentSuggestions
  }

  extend type InvoiceReceipt {
    " missing info suggestions data "
    missingInfoSuggestions: DocumentSuggestions
  }

  " represent document suggestions for missing info "
  type DocumentSuggestions {
    " The counter-side of the document (opposite to it's owner) "
    counterparty: Counterparty
    " The document amount "
    amount: FinancialAmount
  }
`;
