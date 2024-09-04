import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    corporateTaxByDate(date: TimelessDate!): CorporateTax! @auth(role: ACCOUNTANT)
  }

  " Corporate tax variables "
  type CorporateTax {
    corporateId: UUID!
    date: TimelessDate!
    taxRate: Float!
  }
`;
