import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " Find potential matches for a single unmatched charge "
    findChargeMatches(chargeId: UUID!): ChargeMatchesResult! @requiresAuth
    " Paginated queue of unmatched charges awaiting match review, each carrying its scored match suggestions "
    chargesAwaitingMatchQueue(
      " Maximum number of base charges to return per page "
      limit: Int = 20
      " Number of base charges to skip (pagination offset) "
      offset: Int = 0
      " Include only charges involving this business "
      businessId: UUID
      " Include only charges with main date occurred on or after this date "
      fromDate: TimelessDate
      " Include only charges with main date occurred on or before this date "
      toDate: TimelessDate
      " Include only base charges of this kind (document-based or transaction-based) "
      mode: ChargeMatchQueueMode
      " Ordering of the queue "
      sortBy: ChargeMatchQueueSortBy = BY_DATE
    ): ChargesAwaitingMatchResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  extend type Mutation {
    " Automatically match all unmatched charges above the confidence threshold "
    autoMatchCharges: AutoMatchChargesResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " Kind of base charge to include in the awaiting-match queue "
  enum ChargeMatchQueueMode {
    " Base charges built from documents (e.g. invoices from email ingestion) "
    DOC_BASE
    " Base charges built from transactions (e.g. bank feed scraper) "
    TRANSACTION_BASE
  }

  " Ordering options for the awaiting-match queue "
  enum ChargeMatchQueueSortBy {
    " Order by the base charge's date, newest first (default) "
    BY_DATE
    " Order by top match confidence score, highest first. Evaluates only the 100 most recent unmatched charges "
    BY_SCORE
  }

  " Paginated result of the awaiting-match queue query "
  type ChargesAwaitingMatchResult {
    " The requested page of unmatched base charges, each with its match suggestions "
    baseCharges: [ChargeWithSuggestions!]!
    " Total number of unmatched base charges that satisfy the filters "
    totalCount: Int!
  }

  " An unmatched base charge together with its scored match suggestions "
  type ChargeWithSuggestions {
    " UUID of the unmatched base charge "
    id: ID!
    " The unmatched base charge under review "
    baseCharge: Charge!
    " Match suggestions for the base charge, ordered by confidence score (highest first) "
    suggestions: [ChargeMatch!]!
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
    charge: Charge!
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
