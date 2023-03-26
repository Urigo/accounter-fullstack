import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    findMatchingBusinesses: BusinessesMatchesResponse!
  }

  " A score for a business match "
  type BusinessMatchScore {
    business: Counterparty
    score: Float
  }

  " Businesses Name Matches Response "
  type BusinessesMatchesResponse {
    matches: [BusinessesMatches]!
  }

  " Businesses Name Matches "
  type BusinessesMatches {
    business: Counterparty!
    bestScore: BusinessMatchScore
    scores: [BusinessMatchScore!]!
  }
`;
