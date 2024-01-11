import { EmployeesProvider } from '../providers/employees.provider.js';
import type { SalariesModule } from '../types.js';

export const employeesResolvers: SalariesModule.Resolvers = {
  Query: {
    employeesByEmployerId: async (_, { employerId }, { injector }) => {
      const employees = await injector
        .get(EmployeesProvider)
        .getEmployeesByEmployerLoader.load(employerId);
      return employees.map(employee => ({
        id: employee.business_id,
        name: `${employee.first_name} ${employee.last_name}`,
      }));
    },
  },
};
