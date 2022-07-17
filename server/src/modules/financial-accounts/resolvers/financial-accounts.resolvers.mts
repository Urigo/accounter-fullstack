import { FinancialAccountsModule } from "../generated-types/graphql";

const commonFinancialAccountFields: FinancialAccountsModule.CardFinancialAccountResolvers | FinancialAccountsModule.BankFinancialAccountResolvers = {
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
        pool
      );
      return charges;
    },
  };