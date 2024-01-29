import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allPensionFunds: [PensionFund!]!
    allTrainingFunds: [TrainingFund!]!
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
