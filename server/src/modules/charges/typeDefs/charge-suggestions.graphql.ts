import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Charge {
    " missing info suggestions data "
    missingInfoSuggestions: ChargeSuggestions
  }

  " represent charge suggestions for missing info "
  type ChargeSuggestions {
    business: Counterparty!
    description: String
    beneficiaries: [BeneficiaryCounterparty!]
    tags: [Tag!]!
    vat: FinancialAmount
  }
`;
