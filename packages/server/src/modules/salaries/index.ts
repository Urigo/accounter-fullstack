import employees from './typeDefs/employees.graphql.js';
import funds from './typeDefs/funds.graphql.js';
import salaries from './typeDefs/salaries.graphql.js';
import { createModule } from 'graphql-modules';
import { EmployeesProvider } from './providers/employees.provider.js';
import { FundsProvider } from './providers/funds.provider.js';
import { RecoveryProvider } from './providers/recovery.provider.js';
import { SalariesProvider } from './providers/salaries.provider.js';
import { employeesResolvers } from './resolvers/employees.resolvers.js';
import { fundsResolvers } from './resolvers/funds.resolvers.js';
import { salariesResolvers } from './resolvers/salaries.resolvers.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const salariesModule = createModule({
  id: 'salaries',
  dirname: __dirname,
  typeDefs: [salaries, employees, funds],
  resolvers: [salariesResolvers, employeesResolvers, fundsResolvers],
  providers: () => [SalariesProvider, EmployeesProvider, FundsProvider, RecoveryProvider],
});

export * as SalariesTypes from './types.js';
