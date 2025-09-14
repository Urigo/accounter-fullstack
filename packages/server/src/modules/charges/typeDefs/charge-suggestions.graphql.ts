import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " get similar charges "
    similarCharges(
      chargeId: UUID!
      withMissingTags: Boolean
      withMissingDescription: Boolean
      tagsDifferentThan: [String!]
      descriptionDifferentThan: String
    ): [Charge!]! @auth(role: ACCOUNTANT)
    similarChargesByBusiness(
      businessId: UUID!
      ownerId: UUID
      tagsDifferentThan: [String!]
      descriptionDifferentThan: String
    ): [Charge!]! @auth(role: ACCOUNTANT)
  }

  extend interface Charge {
    " missing info suggestions data "
    missingInfoSuggestions: ChargeSuggestions
  }

  extend type CommonCharge {
    missingInfoSuggestions: ChargeSuggestions
  }

  extend type FinancialCharge {
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

  extend type ForeignSecuritiesCharge {
    missingInfoSuggestions: ChargeSuggestions
  }

  extend type CreditcardBankCharge {
    missingInfoSuggestions: ChargeSuggestions
  }

  " represent charge suggestions for missing info "
  type ChargeSuggestions {
    description: String
    tags: [Tag!]!
  }
`;
