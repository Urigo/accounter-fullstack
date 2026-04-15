import { GraphQLError } from 'graphql';
import { errorSimplifier } from '../../../shared/errors.js';
import { formatFinancialAmount } from '../../../shared/helpers/index.js';
import { BankDepositChargesProvider } from '../providers/bank-deposit-charges.provider.js';
import type { BankDepositsModule } from '../types.js';

export const bankDepositChargesResolvers: BankDepositsModule.Resolvers = {
  Query: {
    depositByCharge: async (_, { chargeId }, { injector }) => {
      try {
        return await injector
          .get(BankDepositChargesProvider)
          .getBankDepositByChargeIdLoader.load(chargeId);
      } catch (e) {
        throw errorSimplifier('Error fetching deposit by charge', e);
      }
    },
  },
  Mutation: {
    assignChargeToDeposit: async (_, { chargeId, depositId }, { injector }) => {
      try {
        await injector.get(BankDepositChargesProvider).assignChargeToDeposit(chargeId, depositId);

        return injector
          .get(BankDepositChargesProvider)
          .getBankDepositByChargeIdLoader.load(chargeId)
          .then(deposit => {
            if (!deposit) {
              throw new GraphQLError('Deposit not found for charge after assignment');
            }
            return deposit;
          });
      } catch (e) {
        throw errorSimplifier('Error assigning transaction to deposit', e);
      }
    },
  },
  BankDeposit: {
    metadata: async (deposit, _, { injector }) => {
      try {
        return await injector
          .get(BankDepositChargesProvider)
          .getBankDepositMetadataLoader.load(deposit.id);
      } catch (e) {
        throw errorSimplifier(`Error fetching metadata for deposit ${deposit.name}`, e);
      }
    },
  },
  BankDepositMetadata: {
    id: metadata => metadata.id,
    currentBalance: metadata => formatFinancialAmount(metadata.currentBalance),
    totalInterest: metadata => formatFinancialAmount(metadata.totalInterest),
    totalDeposit: metadata => formatFinancialAmount(metadata.totalDeposit),
    potentialCloseDate: metadata =>
      Math.abs(metadata.currentBalance) >= 0.005 ? metadata.potentialCloseDate : null,
    transactions: metadata => metadata.transactionIds,
  },
};
