import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    allPensionFunds: [PensionFund!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    allTrainingFunds: [TrainingFund!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " fund entity prototype "
  interface Fund {
    id: UUID!
    name: String!
  }

  " represent pension fund"
  type PensionFund implements Fund {
    id: UUID!
    name: String!
  }

  " represent training fund"
  type TrainingFund implements Fund {
    id: UUID!
    name: String!
  }
`;
