// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllEmployeesByEmployer($employerId: UUID!) {
    employeesByEmployerId(employerId: $employerId) {
      id
      name
    }
  }
`;

export {};
