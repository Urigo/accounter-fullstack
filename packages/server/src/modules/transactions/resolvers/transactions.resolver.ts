import { GraphQLError } from 'graphql';
import { deleteCharges } from '@modules/charges/helpers/delete-charges.helper.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { EMPTY_UUID } from '@shared/constants';
import type { Resolvers } from '@shared/gql-types';
import { formatCurrency } from '@shared/helpers';
import { IUpdateTransactionParams } from '../__generated__/transactions-new.types.js';
import { effectiveDateSupplement } from '../helpers/effective-date.helper.js';
import { TransactionsNewProvider } from '../providers/transactions-new.provider.js';
import type { TransactionsModule } from '../types.js';
import { commonChargeFields, commonTransactionFields } from './common.js';

export const transactionsResolvers: TransactionsModule.Resolvers &
  Pick<Resolvers, 'UpdateTransactionResult'> = {
  Query: {
    transactionsByIDs: async (_, { transactionIDs }, { injector }) => {
      if (transactionIDs.length === 0) {
        return [];
      }

      const dbTransactions = await injector
        .get(TransactionsNewProvider)
        .transactionByIdLoader.loadMany(transactionIDs);
      if (!dbTransactions) {
        if (transactionIDs.length === 1) {
          throw new GraphQLError(`Transaction ID="${transactionIDs[0]}" not found`);
        } else {
          throw new GraphQLError(`Couldn't find any transactions`);
        }
      }

      transactionIDs.map(id => {
        const transaction = dbTransactions.find(
          transaction => transaction && 'id' in transaction && transaction.id === id,
        );
        if (!transaction) {
          throw new GraphQLError(`Transaction ID="${id}" not found`);
        }
      });
      return transactionIDs;
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
            .get(TransactionsNewProvider)
            .transactionByIdLoader.load(transactionId);
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
                    if (e instanceof GraphQLError) {
                      throw e;
                    }
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

        await chargePromise;

        const adjustedFields: IUpdateTransactionParams = {
          transactionId,
          businessId: fields.counterpartyId,
          chargeId: chargeId ?? null,
          debitDate: fields.effectiveDate ?? null,
          isFee: fields.isFee,
        };

        const res = await injector
          .get(TransactionsNewProvider)
          .updateTransaction({ ...adjustedFields });
        if (!res[0]?.id) {
          throw new GraphQLError('Transaction update failed');
        }

        await postUpdateActions();

        return res[0].id;
      } catch (e) {
        if (e instanceof GraphQLError) {
          throw e;
        }
        console.error(e);
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
    },
  },
  UpdateTransactionResult: {
    __resolveType: async (raw, { injector }, _info) => {
      if (typeof raw === 'string') {
        const transaction = await injector
          .get(TransactionsNewProvider)
          .transactionByIdLoader.load(raw);

        const charge = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.load(transaction.charge_id);
        return charge.type === 'CONVERSION' ? 'ConversionTransaction' : 'CommonTransaction';
      }
      if (typeof raw === 'object' && '__typename' in raw && raw.__typename === 'CommonError') {
        return 'CommonError';
      }
      throw new GraphQLError('Unexpected type for UpdateTransactionResult');
    },
  },
  CommonCharge: commonChargeFields,
  FinancialCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
  DividendCharge: commonChargeFields,
  BusinessTripCharge: commonChargeFields,
  MonthlyVatCharge: commonChargeFields,
  BankDepositCharge: commonChargeFields,
  CreditcardBankCharge: commonChargeFields,
  ConversionTransaction: {
    __isTypeOf: async (transactionId, { injector }) => {
      const transaction = await injector
        .get(TransactionsNewProvider)
        .transactionByIdLoader.load(transactionId);

      const charge = await injector
        .get(ChargesProvider)
        .getChargeByIdLoader.load(transaction.charge_id);
      return charge.type === 'CONVERSION';
    },
    ...commonTransactionFields,
    effectiveDate: async (transactionId, __dirname, { injector }) => {
      const transaction = await injector
        .get(TransactionsNewProvider)
        .transactionByIdLoader.load(transactionId);

      const date = effectiveDateSupplement(transaction);
      if (!date) {
        console.error(`Conversion transaction ID="${transactionId}" has no effective date`);
        throw new GraphQLError('Conversion transaction must have effective date');
      }
      return date;
    },
    type: async (transactionId, __dirname, { injector }) => {
      const transaction = await injector
        .get(TransactionsNewProvider)
        .transactionByIdLoader.load(transactionId);
      return Number(transaction.amount) > 0 ? 'QUOTE' : 'BASE';
    },
    bankRate: async (transactionId, __dirname, { injector }) => {
      const transaction = await injector
        .get(TransactionsNewProvider)
        .transactionByIdLoader.load(transactionId);

      return transaction.currency_rate;
    },
    officialRateToLocal: async (
      transactionId,
      _,
      { injector, adminContext: { defaultLocalCurrency } },
    ) => {
      const transaction = await injector
        .get(TransactionsNewProvider)
        .transactionByIdLoader.load(transactionId);

      return injector
        .get(ExchangeProvider)
        .getExchangeRates(
          defaultLocalCurrency,
          formatCurrency(transaction.currency),
          transaction.event_date,
        );
    },
  },
  CommonTransaction: {
    __isTypeOf: async (transactionId, { injector }) => {
      const transaction = await injector
        .get(TransactionsNewProvider)
        .transactionByIdLoader.load(transactionId);

      const charge = await injector
        .get(ChargesProvider)
        .getChargeByIdLoader.load(transaction.charge_id);
      if (!charge) {
        throw new GraphQLError(`Charge ID="${transaction.charge_id}" not found`);
      }
      if (charge instanceof GraphQLError) {
        console.error(charge);
        throw new GraphQLError(`Charge ID="${transaction.charge_id}" not found`);
      }
      return charge.type !== 'CONVERSION';
    },
    ...commonTransactionFields,
  },
};
