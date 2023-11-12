import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend interface Charge {
    " salary records "
    salaryRecords: [Salary!]!
  }

  extend type CommonCharge {
    salaryRecords: [Salary!]!
  }

  extend type ConversionCharge {
    salaryRecords: [Salary!]!
  }

  " defines salary records for charge arrangement" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type Salary {
    directAmount: FinancialAmount!
    baseAmount: FinancialAmount
    employeeId: String!
  }
`;
