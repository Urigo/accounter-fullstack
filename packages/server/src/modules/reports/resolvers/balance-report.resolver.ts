import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { Currency } from '@shared/enums';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { BalanceReportProvider } from '../providers/balance-report.provider.js';
import type { ReportsModule } from '../types.js';

export const balanceReportResolver: ReportsModule.Resolvers = {
  Query: {
    transactionsForBalanceReport: async (_, { fromDate, toDate, ownerId }, context) => {
      const {
        injector,
        adminContext: { defaultAdminBusinessId },
      } = context;

      try {
        return injector.get(BalanceReportProvider).getNormalizedBalanceTransactions({
          fromDate,
          toDate,
          ownerId: ownerId ?? defaultAdminBusinessId,
        });
      } catch (error) {
        const message = 'Failed to get balance transactions';
        console.error(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
  },
  BalanceTransactions: {
    id: t => t.id!,
    chargeId: t => t.charge_id!,
    amount: t => formatFinancialAmount(t.amount, Currency.Usd),
    date: t => dateToTimelessDateString(t.debit_date!),
    month: t => t.month!,
    year: t => t.year!,
    counterparty: (t, _, context) =>
      t.business_id
        ? context.injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.load(t.business_id)
            .then(res => res ?? null)
        : null,
    isFee: t => t.is_fee ?? false,
    description: t => t.source_description ?? null,
    charge: (t, _, context) => {
      if (!t.charge_id) {
        throw new GraphQLError(`Charge ID missing for transaction ID ${t.id}`);
      }
      return context.injector
        .get(ChargesProvider)
        .getChargeByIdLoader.load(t.charge_id)
        .then(res => {
          if (!res) {
            throw new GraphQLError(`Charge not found for ID ${t.charge_id}`);
          }
          return res;
        });
    },
  },
};
