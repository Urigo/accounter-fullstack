import { gql } from 'graphql-modules';

export default gql`
  extend type ForeignSecuritiesCharge {
    " Securities referenced by this charge's transactions, resolved against the ingested Poalim securities list "
    securities: [ChargeSecurity!]!
  }

  " A security key carried by a charge's transaction descriptions, with its reference details when ingested "
  type ChargeSecurity {
    id: ID!
    " Poalim security key, leading zeros stripped "
    securityKey: String!
    " Reference details; null when no matching security was ingested for this owner "
    details: Security
    " The charge's transactions whose description carries this key "
    transactions: [Transaction!]!
  }

  " Static reference details of a security held in a Poalim trading account "
  type Security {
    id: UUID!
    " Poalim security key, as reported by the bank (unpadded) "
    key: String!
    engName: String!
    hebName: String!
    symbol: String
    engSymbol: String
    hebSymbol: String
    itemType: String!
    stockType: String
    " Empty string in the source is normalized to null "
    exchange: String
    " Kept as a free string, not the Currency enum, for source fidelity "
    currencyCode: String!
    isEtf: Boolean
    isForeign: Boolean!
    " When the reference list was last scraped "
    asOfDate: DateTime!
  }
`;
