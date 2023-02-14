import { gql } from 'graphql-modules';

export default gql`
  extend type Charge {
    " a list of beneficiaries and their part in the charge "
    beneficiaries: [BeneficiaryCounterparty!]!
  }

  " input variables for beneficiary"
  input BeneficiaryInput {
    counterparty: CounterpartyInput!
    percentage: Percentage!
  }

  extend input UpdateChargeInput {
    beneficiaries: [BeneficiaryInput!]
  }
`;
