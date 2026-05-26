import { GraphQLError } from 'graphql';
import { Currency } from '../../../shared/enums.js';
import { dateToTimelessDateString, formatFinancialAmount } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ScopeProvider } from '../../auth/providers/scope.provider.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { getFinancialAccountByTransactionId } from '../../financial-accounts/helpers/account-by-transaction.helper.js';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';
import { BalanceReportProvider } from '../providers/balance-report.provider.js';
import type { ReportsModule } from '../types.js';

export const balanceReportResolver: ReportsModule.Resolvers = {
  Query: {
    transactionsForBalanceReport: async (_, { fromDate, toDate, ownerId }, { injector }) => {
      // Per-business report: validate an explicit owner against the read scope
      // (throws if out of scope); blank/omitted defaults to the primary business.
      const trimmedOwnerId = ownerId?.trim();
      let targetOwnerId: string;
      if (trimmedOwnerId) {
        await injector.get(ScopeProvider).getReadScope([trimmedOwnerId]);
        targetOwnerId = trimmedOwnerId;
      } else {
        targetOwnerId = (await injector.get(AdminContextProvider).getVerifiedAdminContext())
          .ownerId;
      }

      try {
        return injector.get(BalanceReportProvider).getNormalizedBalanceTransactions({
          fromDate,
          toDate,
          ownerId: targetOwnerId,
        });
      } catch (error) {
        const message = 'Failed to get balance transactions';
        console.error(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
  },
  BalanceTransactions: {
    id: t => t.id,
    chargeId: t => t.charge_id,
    amount: t => formatFinancialAmount(t.amount, t.currency),
    amountUsd: t => formatFinancialAmount(t.amount_usd, Currency.Usd),
    date: t => dateToTimelessDateString(t.debit_date!),
    month: t => t.month!,
    year: t => t.year!,
    counterparty: (t, _, { injector }) =>
      t.business_id
        ? injector
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
    account: async (t, _, { injector }) => getFinancialAccountByTransactionId(t.id, injector),
  },
};
