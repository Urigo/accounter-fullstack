import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    findMatchingBusinesses(
      " The minimum score to return a match, 0-1 "
      minScore: Float
    ): [BusinessesMatches!]!
  }

  " A score for a business match "
  type BusinessMatchScore {
    " The business that was matched "
    business: Counterparty
    " The score of the match, 0-1 "
    score: Float
  }

  " Businesses Name Matches "
  type BusinessesMatches {
    " The business being matched "
    business: Counterparty!
    " The best match for the business "
    bestMatch: BusinessMatchScore
    " Other matches for the business "
    moreMatches: [BusinessMatchScore!]
  }
`;
