import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " Every business that stands for a traded security, for pickers scoped to securities "
    allSecurityBusinesses: [LtdFinancialEntity!]! @requiresAuth
  }

  extend type LtdFinancialEntity {
    " Security details; set only when this business stands for a single traded security "
    securityInfo: SecurityBusiness
  }

  " A business that stands for one traded security, identified by its ISIN "
  type SecurityBusiness {
    id: UUID!
    " The business this security is represented by "
    business: LtdFinancialEntity!
    isin: String!
    " How every ingesting source names this security "
    identifiers: [SecurityIdentifier!]!
    " Descriptors cached from the ingested rows; the securities feeds stay the source of truth "
    symbol: String
    engName: String
    hebName: String
    exchange: String
    " Kept as a free string, not the Currency enum, for source fidelity "
    currencyCode: String
    itemType: String
    stockType: String
    isEtf: Boolean
    isForeign: Boolean
    issuerCountryCode: String
  }

  " One source's name for a security "
  type SecurityIdentifier {
    id: UUID!
    type: SecurityIdentifierType!
    value: String!
  }

  " The sources a security can be identified by "
  enum SecurityIdentifierType {
    " Poalim's proprietary security key, as carried by transaction descriptions "
    POALIM_SECURITY_KEY
    ISIN
  }
`;
