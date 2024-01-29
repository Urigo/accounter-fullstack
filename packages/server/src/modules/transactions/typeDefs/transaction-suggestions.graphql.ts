import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend interface Transaction {
    " missing info suggestions data "
    missingInfoSuggestions: TransactionSuggestions
  }

  extend type CommonTransaction {
    missingInfoSuggestions: TransactionSuggestions
  }

  extend type WireTransaction {
    missingInfoSuggestions: TransactionSuggestions
  }

  extend type FeeTransaction {
    missingInfoSuggestions: TransactionSuggestions
  }

  extend type ConversionTransaction {
    missingInfoSuggestions: TransactionSuggestions
  }

  " represent transaction suggestions for missing info "
  type TransactionSuggestions {
    business: FinancialEntity!
  }
`;
