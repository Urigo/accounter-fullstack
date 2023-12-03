import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';
import { formatFinancialAmount } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import { BusinessTripsProvider } from '../providers/business-trips.provider.js';
import type { BusinessTripsModule } from '../types.js';

export const commonChargeFields: BusinessTripsModule.ChargeResolvers = {
  businessTrip: (dbCharge, _, { injector }) => {
    if (!dbCharge.business_trip_id) {
      return null;
    }
    try {
      return injector
        .get(BusinessTripsProvider)
        .getBusinessTripsByIdLoader.load(dbCharge.business_trip_id)
        .then(businessTrip => businessTrip ?? null);
    } catch (e) {
      console.error(`Error finding business trip for charge id ${dbCharge.id}:`, e);
      throw new GraphQLError(`Error finding business trip for charge id ${dbCharge.id}`);
    }
  },
};

export const commonBusinessTransactionFields: BusinessTripsModule.BusinessTripTransactionResolvers =
  {
    id: DbTransaction => DbTransaction.id,
    businessTrip: (DbTransaction, _, { injector }) =>
      injector
        .get(BusinessTripsProvider)
        .getBusinessTripsByIdLoader.load(DbTransaction.business_trip_id)
        .then(res => {
          if (!res) {
            throw new GraphQLError(
              `Business trip with id ${DbTransaction.business_trip_id} not found`,
            );
          }
          return res;
        }),
    date: DbTransaction =>
      DbTransaction.date ? (format(DbTransaction.date, 'yyyy-MM-dd') as TimelessDateString) : null,
    amount: DbTransaction =>
      DbTransaction.amount && DbTransaction.currency
        ? formatFinancialAmount(DbTransaction.amount, DbTransaction.currency)
        : null,
    employee: DbTransaction => DbTransaction.employee_business_id,
    transaction: async (DbTransaction, _, { injector }) =>
      DbTransaction.transaction_id
        ? injector
            .get(TransactionsProvider)
            .getTransactionByIdLoader.load(DbTransaction.transaction_id)
            .then(res => {
              if (!res) {
                throw new GraphQLError(
                  `Transaction with id ${DbTransaction.transaction_id} not found`,
                );
              }
              return res as IGetTransactionsByIdsResult;
            })
        : await null,
  };
