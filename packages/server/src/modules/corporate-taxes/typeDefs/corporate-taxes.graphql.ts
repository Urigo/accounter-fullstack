import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    corporateTaxByDate(date: TimelessDate!): CorporateTax! @auth(role: ACCOUNTANT)
  }

  " Corporate tax variables "
  type CorporateTax {
    id: ID!
    corporateId: UUID!
    date: TimelessDate!
    taxRate: Float!
  }
`;
