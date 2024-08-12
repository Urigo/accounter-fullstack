import { GraphQLError } from 'graphql';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';
import { formatFinancialAmount, optionalDateToTimelessDateString } from '@shared/helpers';
import { BusinessTripsProvider } from '../providers/business-trips.provider.js';
import type { BusinessTripsModule } from '../types.js';

export const commonBusinessTripTransactionFields: BusinessTripsModule.BusinessTripTransactionResolvers =
  {
    id: DbTransaction => DbTransaction.id!,
    businessTrip: (DbTransaction, _, { injector }) =>
      injector
        .get(BusinessTripsProvider)
        .getBusinessTripsByIdLoader.load(DbTransaction.business_trip_id!)
        .then(res => {
          if (!res) {
            throw new GraphQLError(
              `Business trip with id ${DbTransaction.business_trip_id} not found`,
            );
          }
          return res;
        }),
    date: DbTransaction => optionalDateToTimelessDateString(DbTransaction.date),
    valueDate: DbTransaction => optionalDateToTimelessDateString(DbTransaction.value_date),
    amount: DbTransaction =>
      DbTransaction.amount && DbTransaction.currency
        ? formatFinancialAmount(DbTransaction.amount, DbTransaction.currency)
        : null,
    employee: (DbTransaction, _, { injector }) =>
      DbTransaction.employee_business_id
        ? injector
            .get(BusinessesProvider)
            .getBusinessByIdLoader.load(DbTransaction.employee_business_id)
            .then(res => {
              if (!res) {
                throw new GraphQLError(
                  `Employee with id ${DbTransaction.employee_business_id} not found`,
                );
              }
              return res;
            })
        : null,
    transactions: async (DbTripTransaction, _, { injector }) =>
      DbTripTransaction.transaction_ids?.length
        ? injector
            .get(TransactionsProvider)
            .getTransactionByIdLoader.loadMany(DbTripTransaction.transaction_ids)
            .then(res => {
              if (!res) {
                throw new GraphQLError(
                  `Some transaction of business trip transaction id ${DbTripTransaction.id} were not found`,
                );
              }
              return res as IGetTransactionsByIdsResult[];
            })
        : Promise.resolve(null),
    payedByEmployee: dbTransaction => dbTransaction.payed_by_employee,
  };
