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

  extend type InternalTransferCharge {
    missingInfoSuggestions: ChargeSuggestions
  }

  extend type DividendCharge {
    missingInfoSuggestions: ChargeSuggestions
  }

  extend type BusinessTripCharge {
    missingInfoSuggestions: ChargeSuggestions
  }

  extend type MonthlyVatCharge {
    missingInfoSuggestions: ChargeSuggestions
  }

  extend type BankDepositCharge {
    missingInfoSuggestions: ChargeSuggestions
  }

  " represent charge suggestions for missing info "
  type ChargeSuggestions {
    description: String
    tags: [Tag!]!
  }
`;
