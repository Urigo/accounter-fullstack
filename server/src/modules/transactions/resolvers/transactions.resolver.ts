import { GraphQLError } from 'graphql';
import { deleteCharge } from '@modules/charges/helpers/delete-charge.helper.js';
import { ChargesTypes } from '@modules/charges/index.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { getRateForCurrency } from '@modules/exchange-rates/helpers/exchange.helper.js';
import { FiatExchangeProvider } from '@modules/exchange-rates/providers/fiat-exchange.provider.js';
import { TagsProvider } from '@modules/tags/providers/tags.provider.js';
import { Currency } from '@shared/enums';
import type { Resolvers } from '@shared/gql-types';
import { effectiveDateSupplement } from '../helpers/effective-date.helper.js';
import { TransactionsProvider } from '../providers/transactions.provider.js';
import type {
  IGetTransactionsByIdsResult,
  IUpdateTransactionParams,
  TransactionsModule,
} from '../types.js';
import { commonChargeFields, commonTransactionFields } from './common.js';

export const transactionsResolvers: TransactionsModule.Resolvers &
  Pick<Resolvers, 'UpdateTransactionResult'> = {
  Query: {
    transactionsByIDs: async (_, { transactionIDs }, { injector }) => {
      if (transactionIDs.length === 0) {
        return [];
      }

      const dbTransactions = await injector
        .get(TransactionsProvider)
        .getTransactionByIdLoader.loadMany(transactionIDs);
      if (!dbTransactions) {
        if (transactionIDs.length === 1) {
          throw new GraphQLError(`Transaction ID="${transactionIDs[0]}" not found`);
        } else {
          throw new GraphQLError(`Couldn't find any transactions`);
        }
      }

      const transactions = transactionIDs.map(id => {
        const transaction = dbTransactions.find(
          transaction => transaction && 'id' in transaction && transaction.id === id,
        );
        if (!transaction) {
          throw new GraphQLError(`Transaction ID="${id}" not found`);
        }
        return transaction as IGetTransactionsByIdsResult;
      });
      return transactions;
    },
  },
  Mutation: {
    updateTransaction: async (_, { transactionId, fields }, { injector }) => {
      let postUpdateActions = async (): Promise<void> => void 0;

      try {
        let charge: ChargesTypes.IGetChargesByIdsResult | undefined;

        let chargeId = fields.chargeId;
        if (chargeId && chargeId !== 'NULL') {
          // case new charge ID
          charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
          if (!charge) {
            throw new GraphQLError(`Charge ID="${chargeId}" not valid`);
          }
        } else if (chargeId === 'NULL') {
          // case unlinked from charge
          const transaction = await injector
            .get(TransactionsProvider)
            .getTransactionByIdLoader.load(transactionId);
          if (!transaction) {
            throw new GraphQLError(`Transaction ID="${transactionId}" not valid`);
          }
          if (transaction.charge_id) {
            const charge = await injector
              .get(ChargesProvider)
              .getChargeByIdLoader.load(transaction.charge_id);
            if (!charge) {
              throw new GraphQLError(`Former transaction's charge ID ("${chargeId}") not valid`);
            }

            // generate new charge
            const newCharge = await injector.get(ChargesProvider).generateCharge({
              ownerId: charge.owner_id,
              userDescription: 'Transaction unlinked from charge',
            });
            if (!newCharge || newCharge.length === 0) {
              throw new GraphQLError(
                `Failed to generate new charge for transaction ID="${transactionId}"`,
              );
            }
            chargeId = newCharge?.[0]?.id;

            if (
              Number(charge.documents_count ?? 0) === 0 &&
              Number(charge.transactions_count ?? 1) === 1
            ) {
              postUpdateActions = async () => {
                try {
                  await deleteCharge(
                    charge.id,
                    injector.get(ChargesProvider),
                    injector.get(TagsProvider),
                  );
                } catch (e) {
                  throw new GraphQLError(
                    `Failed to delete the empty former charge ID="${charge.id}"`,
                  );
                }
                return postUpdateActions();
              };
            }
          }
        }

        const adjustedFields: IUpdateTransactionParams = {
          accountId: fields.accountId,
          // TODO: implement not-Ils logic. currently if vatCurrency is set and not to Ils, ignoring the update
          Amount:
            fields.amount?.currency && fields.amount.currency !== Currency.Ils
              ? null
              : fields.amount?.raw?.toFixed(2),
          currency: fields.amount?.currency,
          // TODO: implement not-Ils logic. currently if vatCurrency is set and not to Ils, ignoring the update
          currentBalance:
            fields.balance?.currency && fields.balance.currency !== Currency.Ils
              ? null
              : fields.balance?.raw?.toFixed(2),
          debitDate: fields.effectiveDate ? new Date(fields.effectiveDate) : null,
          eventDate: fields.eventDate ? new Date(fields.eventDate) : null,
          sourceDescription: fields.sourceDescription,
          transactionId,
          businessId: fields.counterpartyId,
          chargeId: chargeId ?? null,
        };

        injector.get(TransactionsProvider).getTransactionByIdLoader.clear(transactionId);
        const res = await injector
          .get(TransactionsProvider)
          .updateTransaction({ ...adjustedFields });
        const transaction = await injector
          .get(TransactionsProvider)
          .getTransactionByIdLoader.load(res[0].id);
        if (!transaction) {
          throw new GraphQLError(`Transaction ID="${res[0].id}" not found`);
        }

        await postUpdateActions();

        return transaction as IGetTransactionsByIdsResult;
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
    },
  },
  UpdateTransactionResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'CommonTransaction';
    },
  },
  CommonCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
  // WireTransaction: {
  //   ...commonTransactionFields,
  // },
  // FeeTransaction: {
  //   ...commonTransactionFields,
  // },
  ConversionTransaction: {
    __isTypeOf: DbTransaction => DbTransaction.is_conversion ?? false,
    ...commonTransactionFields,
    effectiveDate: DbTransaction => {
      const date = effectiveDateSupplement(DbTransaction);
      if (!date) {
        console.error(`Conversion transaction ID="${DbTransaction.id}" has no effective date`);
        throw new GraphQLError('Conversion transaction must have effective date');
      }
      return date;
    },
    type: DbTransaction => (Number(DbTransaction.amount) > 0 ? 'QUOTE' : 'BASE'),
    bankRate: DbTransaction => DbTransaction.currency_rate,
    officialRateToLocal: async (DbTransaction, _, { injector }) => {
      const officialRate = await injector
        .get(FiatExchangeProvider)
        .getExchangeRatesByDatesLoader.load(DbTransaction.event_date);
      if (!officialRate) {
        console.error(`Conversion transaction ID="${DbTransaction.id}" has no official rate`);
        throw new GraphQLError('Conversion transaction must have official rate');
      }
      return getRateForCurrency(DbTransaction.currency, officialRate);
    },
  },
  CommonTransaction: {
    __isTypeOf: DbTransaction => DbTransaction.is_conversion !== true,
    ...commonTransactionFields,
  },
};
