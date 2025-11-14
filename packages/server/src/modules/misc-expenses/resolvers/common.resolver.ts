import { MiscExpensesProvider } from '../providers/misc-expenses.provider.js';
import { MiscExpensesModule } from '../types.js';

export const commonChargeFields: MiscExpensesModule.ChargeResolvers = {
  miscExpenses: (chargeId, _, { injector }) =>
    injector.get(MiscExpensesProvider).getExpensesByChargeIdLoader.load(chargeId),
};
