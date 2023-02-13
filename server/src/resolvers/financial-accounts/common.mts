import {
  BankFinancialAccountResolvers,
  CardFinancialAccountResolvers,
} from '../../__generated__/types.mjs';
import {
  getChargeByFinancialAccountNumberLoader,
  getChargesByFinancialAccountNumbers,
} from '../../providers/charges.mjs';
import { pool } from '../../providers/db.mjs';

export const commonFinancialAccountFields:
  | CardFinancialAccountResolvers
  | BankFinancialAccountResolvers = {
  id: DbAccount => DbAccount.id,
  charges: async (DbAccount, { filter }) => {
    if (!filter || Object.keys(filter).length === 0) {
      const charges = await getChargeByFinancialAccountNumberLoader.load(DbAccount.account_number);
      return charges;
    }
    const charges = await getChargesByFinancialAccountNumbers.run(
      {
        financialAccountNumbers: [DbAccount.account_number],
        fromDate: filter?.fromDate,
        toDate: filter?.toDate,
      },
      pool,
    );
    return charges;
  },
};
