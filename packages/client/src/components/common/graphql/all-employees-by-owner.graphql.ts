import { graphql } from '../../../graphql.js';

export const AllEmployeesByEmployerDocument = graphql(`
  query AllEmployeesByEmployer($employerId: UUID!) {
    employeesByEmployerId(employerId: $employerId) {
      id
      name
    }
  }
`);
