import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    findMatchingBusinesses: BusinessesMatches!
  }

  " A score for a business match "
  type BusinessMatchScore {
    name: String
    score: Float
    id: UUID
  }

  " Businesses Name Matches "
  type BusinessesMatches {
    bestScore: BusinessMatchScore!
    scores: [BusinessMatchScore!]!
  }
`;
