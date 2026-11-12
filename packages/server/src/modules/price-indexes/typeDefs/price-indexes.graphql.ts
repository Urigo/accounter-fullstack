import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    priceIndexValues(
      type: PriceIndexType!
      " first month, YYYY-MM "
      fromPeriod: String!
      " last month, YYYY-MM "
      toPeriod: String!
    ): [PriceIndexValue!]! @requiresAuth
    priceIndexLinkage(
      type: PriceIndexType!
      amount: Float!
      from: PriceIndexPointInput!
      to: PriceIndexPointInput!
    ): PriceIndexLinkage! @requiresAuth
  }

  extend type Mutation {
    " super-admin only: pull the latest price indexes from CBS "
    syncPriceIndexes(full: Boolean): [PriceIndexSyncResult!]! @requiresAuth
  }

  " CBS price index series "
  enum PriceIndexType {
    CONSUMER_PRICE_INDEX
  }

  " how a date is resolved to an index month "
  enum PriceIndexMode {
    " the index last published before the date (Income Tax Ordinance s.88 'known index') "
    KNOWN
    " the index for the date's month "
    FOR_PERIOD
  }

  " a point in time to link from or to "
  input PriceIndexPointInput {
    date: TimelessDate!
    mode: PriceIndexMode = KNOWN
  }

  " a monthly price index value "
  type PriceIndexValue {
    " YYYY-MM "
    period: String!
    " value as published, in its base "
    value: Float!
    base: String!
    " value expressed in the latest base of the series "
    valueInLatestBase: Float!
    latestBase: String!
    monthlyChangePercent: Float
    yearlyChangePercent: Float
    publishedOn: TimelessDate!
  }

  " an amount linked between two points of a price index "
  type PriceIndexLinkage {
    amount: Float!
    linkedAmount: Float!
    linkageDifference: Float!
    ratio: Float!
    changePercent: Float!
    fromIndex: PriceIndexValue!
    toIndex: PriceIndexValue!
  }

  " result of syncing one price index from CBS "
  type PriceIndexSyncResult {
    type: PriceIndexType!
    inserted: Int!
    updated: Int!
    basesUpserted: Int!
    skipped: Boolean!
  }
`;
