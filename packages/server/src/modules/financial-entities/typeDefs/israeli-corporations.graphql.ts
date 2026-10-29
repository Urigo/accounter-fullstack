import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " looks a company up in the Israeli Corporations Authority registry; null when it isn't listed there "
    israeliCorporation(corporationNumber: String!): IsraeliCorporation
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " a company as listed in the Israeli Corporations Authority registry (values in Hebrew) "
  type IsraeliCorporation {
    " registration number (ח.פ.) "
    id: ID!
    " Hebrew name "
    name: String!
    englishName: String
    " e.g. פעילה (active) "
    status: String
    subStatus: String
    " e.g. ישראלית (Israeli) "
    corporationType: String
    " e.g. חברה (company) "
    contactType: String
    " e.g. מוגבלת (limited) "
    limitType: String
    purpose: String
    registrationDate: TimelessDate
    " year of the last annual report filed "
    lastAnnualReport: Int
    isGovernmental: Boolean!
    " the registry's violating-company marking, when there is one "
    violations: String
    address: IsraeliCorporationAddress
  }

  " registered address of an Israeli company "
  type IsraeliCorporationAddress {
    street: String
    houseNumber: String
    city: String
    zipCode: String
    country: String
  }
`;
