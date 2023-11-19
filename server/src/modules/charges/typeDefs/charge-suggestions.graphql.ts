import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend interface Charge {
    " missing info suggestions data "
    missingInfoSuggestions: ChargeSuggestions
  }

  extend type CommonCharge {
    missingInfoSuggestions: ChargeSuggestions
  }

  extend type ConversionCharge {
    missingInfoSuggestions: ChargeSuggestions
  }

  extend type SalaryCharge {
    missingInfoSuggestions: ChargeSuggestions
  }

  " represent charge suggestions for missing info "
  type ChargeSuggestions {
    " redundant. relevant on transaction level "
    business: Counterparty!
    description: String
    " redundant. relevant on transaction level "
    beneficiaries: [BeneficiaryCounterparty!]
    tags: [Tag!]!
    " redundant. relevant on transaction level "
    vat: FinancialAmount
  }
`;
