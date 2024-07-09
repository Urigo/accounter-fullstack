import { GraphQLError } from 'graphql';
import { deleteCharges } from '@modules/charges/helpers/delete-charges.helper.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { getRateForCurrency } from '@modules/exchange-rates/helpers/exchange.helper.js';
import { FiatExchangeProvider } from '@modules/exchange-rates/providers/fiat-exchange.provider.js';
import { EMPTY_UUID } from '@shared/constants';
import type { Resolvers } from '@shared/gql-types';
import { formatCurrency } from '@shared/helpers';
import { effectiveDateSupplement } from '../helpers/effective-date.helper.js';
import { FeeTransactionsProvider } from '../providers/fee-transactions.provider.js';
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
        // let charge: ChargesTypes.IGetChargesByIdsResult | undefined;

        const existingChargePromise = async () => {
          const charge = await injector
            .get(ChargesProvider)
            .getChargeByIdLoader.load(fields.chargeId ?? '');
          if (!charge) {
            throw new GraphQLError(`Charge ID="${chargeId}" not valid`);
          }
        };
        const emptyChargePromise = async () => {
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
              postUpdateActions = async () =>
                deleteCharges([charge.id], injector)
                  .catch(e => {
                    console.error(e);
                    throw new GraphQLError(
                      `Failed to delete the empty former charge ID="${charge.id}"`,
                    );
                  })
                  .then(postUpdateActions);
            }
          }
        };

        let chargeId = fields.chargeId;
        const chargePromise =
          chargeId && chargeId !== EMPTY_UUID
            ? existingChargePromise()
            : chargeId === EMPTY_UUID
              ? emptyChargePromise()
              : Promise.resolve();

        const feePromise = async () => {
          if (fields.isFee === true) {
            return injector.get(FeeTransactionsProvider).addFeeTransaction({
              feeTransactions: [
                {
                  id: transactionId,
                  isRecurring: false,
                },
              ],
            });
          }
          if (fields.isFee === false) {
            return injector.get(FeeTransactionsProvider).deleteFeeTransactionsByIds({
              transactionIds: [transactionId],
            });
          }
          return Promise.resolve();
        };

        await Promise.all([chargePromise, feePromise()]);

        const adjustedFields: IUpdateTransactionParams = {
          transactionId,
          businessId: fields.counterpartyId,
          chargeId: chargeId ?? null,
          debitDate: fields.effectiveDate ?? null,
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
      return 'type' in obj && obj.type === 'CONVERSION'
        ? 'ConversionTransaction'
        : 'CommonTransaction';
    },
  },
  CommonCharge: commonChargeFields,
  RevaluationCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
  DividendCharge: commonChargeFields,
  BusinessTripCharge: commonChargeFields,
  MonthlyVatCharge: commonChargeFields,
  BankDepositCharge: commonChargeFields,
  CreditcardBankCharge: commonChargeFields,
  ConversionTransaction: {
    __isTypeOf: DbTransaction => DbTransaction.charge_type === 'CONVERSION',
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
      return getRateForCurrency(formatCurrency(DbTransaction.currency), officialRate);
    },
  },
  CommonTransaction: {
    __isTypeOf: DbTransaction => DbTransaction.charge_type !== 'CONVERSION',
    ...commonTransactionFields,
  },
};
