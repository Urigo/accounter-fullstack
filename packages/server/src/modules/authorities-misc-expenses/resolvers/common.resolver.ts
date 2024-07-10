import { AuthoritiesMiscExpensesProvider } from '../providers/authorities-misc-expenses.provider.js';
import { AuthoritiesMiscExpensesModule } from '../types.js';

export const commonChargeFields: AuthoritiesMiscExpensesModule.ChargeResolvers = {
  authoritiesMiscExpenses: (dbCharge, _, { injector }) =>
    injector.get(AuthoritiesMiscExpensesProvider).getExpensesByChargeIdLoader.load(dbCharge.id),
};
