import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " Find potential matches for a single unmatched charge "
    findChargeMatches(chargeId: UUID!): ChargeMatchesResult! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    " Automatically match all unmatched charges above the confidence threshold "
    autoMatchCharges: AutoMatchChargesResult! @auth(role: ACCOUNTANT)
  }

  " Result of finding matches for a single charge "
  type ChargeMatchesResult {
    " Array of up to 5 matches, ordered by confidence score (highest first) "
    matches: [ChargeMatch!]!
  }

  " A single charge match with its confidence score "
  type ChargeMatch {
    " UUID of the matched charge "
    chargeId: UUID!
    " Confidence score between 0.00 and 1.00 "
    confidenceScore: Float!
  }

  " Result of the auto-match operation "
  type AutoMatchChargesResult {
    " Total number of charges that were successfully matched and merged "
    totalMatches: Int!
    " Array of charges that were merged, with their confidence scores "
    mergedCharges: [MergedCharge!]!
    " Array of charge UUIDs that had multiple high-confidence matches and were skipped "
    skippedCharges: [UUID!]!
    " Array of error messages encountered during the operation "
    errors: [String!]!
  }

  " A charge that was successfully merged during auto-match "
  type MergedCharge {
    " UUID of the deleted/merged-away charge "
    chargeId: UUID!
    " Confidence score that triggered the merge "
    confidenceScore: Float!
  }
`;
