import { GraphQLError } from 'graphql';
import {
  coreTransactionUpdate,
  generateChargeForEmployeePayment,
} from '../helpers/business-trips-transactions.helper.js';
import { BusinessTripEmployeePaymentsProvider } from '../providers/business-trips-employee-payments.provider.js';
import { BusinessTripAccommodationsTransactionsProvider } from '../providers/business-trips-transactions-accommodations.provider.js';
import { BusinessTripFlightsTransactionsProvider } from '../providers/business-trips-transactions-flights.provider.js';
import { BusinessTripOtherTransactionsProvider } from '../providers/business-trips-transactions-other.provider.js';
import { BusinessTripTravelAndSubsistenceTransactionsProvider } from '../providers/business-trips-transactions-travel-and-subsistence.provider.js';
import { BusinessTripTransactionsProvider } from '../providers/business-trips-transactions.provider.js';
import type { BusinessTripsModule } from '../types.js';
import { commonBusinessTripTransactionFields } from './common.js';

export const businessTripTransactionsResolvers: BusinessTripsModule.Resolvers = {
  Mutation: {
    categorizeBusinessTripTransaction: async (
      _,
      { fields: { businessTripId, transactionId, category, amount } },
      { injector },
    ) => {
      try {
        if (!category) {
          throw new GraphQLError(`Category is required`);
        }

        const [businessTripTransaction] = await injector
          .get(BusinessTripTransactionsProvider)
          .insertBusinessTripTransaction({
            businessTripId,
            category,
          });
        const id = businessTripTransaction.id;

        const updateTransactionMatchPromise = injector
          .get(BusinessTripTransactionsProvider)
          .insertBusinessTripTransactionMatch({
            businessTripTransactionId: id,
            transactionId,
            amount,
          });
        const insertToCategoryPromise = async () => {
          switch (category) {
            case 'FLIGHT':
              return injector
                .get(BusinessTripFlightsTransactionsProvider)
                .insertBusinessTripFlightsTransaction({
                  id,
                });
            case 'ACCOMMODATION':
              return injector
                .get(BusinessTripAccommodationsTransactionsProvider)
                .insertBusinessTripAccommodationsTransaction({
                  id,
                });
            case 'TRAVEL_AND_SUBSISTENCE':
              return injector
                .get(BusinessTripTravelAndSubsistenceTransactionsProvider)
                .insertBusinessTripTravelAndSubsistenceTransaction({ id });
            case 'OTHER':
              return injector
                .get(BusinessTripOtherTransactionsProvider)
                .insertBusinessTripOtherTransaction({
                  id,
                });
            default:
              throw new GraphQLError(`Invalid category ${category}`);
          }
        };
        await Promise.all([updateTransactionMatchPromise, insertToCategoryPromise()]);
        return id;
      } catch (e) {
        console.error(`Error updating business trip transaction's category`, e);
        throw new GraphQLError("Error updating charge's business trip");
      }
    },
    updateBusinessTripFlightsTransaction: async (_, { fields }, { injector }) => {
      try {
        const coreTransactionUpdatePromise = coreTransactionUpdate(injector, fields, 'FLIGHT');

        const { id, origin, destination, flightClass } = fields;
        const hasFlightFieldsToUpdate = origin || destination || flightClass;
        const flightTransactionUpdate = hasFlightFieldsToUpdate
          ? injector
              .get(BusinessTripFlightsTransactionsProvider)
              .updateBusinessTripFlightsTransaction({
                businessTripTransactionId: id,
                origin,
                destination,
                class: flightClass,
              })
          : Promise.resolve();

        await Promise.all([coreTransactionUpdatePromise, flightTransactionUpdate]);

        return id;
      } catch (e) {
        console.error(`Error updating business trip flight transaction`, e);
        throw new GraphQLError('Error updating business trip flight transaction');
      }
    },
    updateBusinessTripAccommodationsTransaction: async (_, { fields }, { injector }) => {
      try {
        const coreTransactionUpdatePromise = coreTransactionUpdate(
          injector,
          fields,
          'ACCOMMODATION',
        );

        const { id, country, nightsCount } = fields;
        const hasAccommodationFieldsToUpdate = country || nightsCount;
        const accommodationTransactionUpdate = hasAccommodationFieldsToUpdate
          ? injector
              .get(BusinessTripAccommodationsTransactionsProvider)
              .updateBusinessTripAccommodationsTransaction({
                businessTripTransactionId: id,
                country,
                nightsCount,
              })
          : Promise.resolve();

        await Promise.all([coreTransactionUpdatePromise, accommodationTransactionUpdate]);

        return id;
      } catch (e) {
        console.error(`Error updating business trip accommodations transaction`, e);
        throw new GraphQLError('Error updating business trip accommodations transaction');
      }
    },
    updateBusinessTripOtherTransaction: async (_, { fields }, { injector }) => {
      try {
        const coreTransactionUpdatePromise = coreTransactionUpdate(injector, fields, 'OTHER');

        const { id, description, deductibleExpense } = fields;
        const hasOtherFieldsToUpdate = description || deductibleExpense != null;
        const otherTransactionUpdate = hasOtherFieldsToUpdate
          ? injector.get(BusinessTripOtherTransactionsProvider).updateBusinessTripOtherTransaction({
              businessTripTransactionId: id,
              description,
              deductibleExpense,
            })
          : Promise.resolve();

        await Promise.all([coreTransactionUpdatePromise, otherTransactionUpdate]);

        return id;
      } catch (e) {
        console.error(`Error updating business trip other transaction`, e);
        throw new GraphQLError('Error updating business trip other transaction');
      }
    },
    updateBusinessTripTravelAndSubsistenceTransaction: async (_, { fields }, { injector }) => {
      try {
        const coreTransactionUpdatePromise = coreTransactionUpdate(
          injector,
          fields,
          'TRAVEL_AND_SUBSISTENCE',
        );

        const { id, expenseType } = fields;
        const hasTravelAndSubsistenceFieldsToUpdate = expenseType;
        const travelAndSubsistenceTransactionUpdate = hasTravelAndSubsistenceFieldsToUpdate
          ? injector
              .get(BusinessTripTravelAndSubsistenceTransactionsProvider)
              .updateBusinessTripTravelAndSubsistenceTransaction({
                businessTripTransactionId: id,
                expenseType,
              })
          : Promise.resolve();

        await Promise.all([coreTransactionUpdatePromise, travelAndSubsistenceTransactionUpdate]);

        return id;
      } catch (e) {
        console.error(`Error updating business trip travel&subsistence transaction`, e);
        throw new GraphQLError('Error updating business trip travel&subsistence transaction');
      }
    },
    deleteBusinessTripTransaction: async (_, { businessTripTransactionId }, { injector }) => {
      try {
        await Promise.all([
          injector
            .get(BusinessTripFlightsTransactionsProvider)
            .deleteBusinessTripFlightsTransaction({ businessTripTransactionId }),
          injector
            .get(BusinessTripAccommodationsTransactionsProvider)
            .deleteBusinessTripAccommodationsTransaction({ businessTripTransactionId }),
          injector
            .get(BusinessTripOtherTransactionsProvider)
            .deleteBusinessTripOtherTransaction({ businessTripTransactionId }),
          injector
            .get(BusinessTripTravelAndSubsistenceTransactionsProvider)
            .deleteBusinessTripTravelAndSubsistenceTransaction({ businessTripTransactionId }),
          injector.get(BusinessTripEmployeePaymentsProvider).deleteBusinessTripEmployeePayment({
            businessTripTransactionId,
          }),
          injector
            .get(BusinessTripTransactionsProvider)
            .deleteBusinessTripTransactionMatch({ businessTripTransactionId }),
        ]);

        // core transaction must be deleted AFTER all extensions were dropped
        await injector
          .get(BusinessTripTransactionsProvider)
          .deleteBusinessTripTransaction({ businessTripTransactionId });

        return true;
      } catch (e) {
        console.error(`Error deleting business trip transaction`, e);
        throw new GraphQLError('Error deleting business trip transaction');
      }
    },
    addBusinessTripFlightsTransaction: async (_, { fields }, { injector }) => {
      try {
        const coreTransactionPromise = injector
          .get(BusinessTripTransactionsProvider)
          .insertBusinessTripTransaction({
            businessTripId: fields.businessTripId,
            category: 'FLIGHT',
          })
          .then(res => res[0]);

        const chargeGenerationPromise = generateChargeForEmployeePayment(
          injector,
          fields.businessTripId,
        );

        const [coreTransaction, chargeId] = await Promise.all([
          coreTransactionPromise,
          chargeGenerationPromise,
        ]);

        await Promise.all([
          injector
            .get(BusinessTripFlightsTransactionsProvider)
            .insertBusinessTripFlightsTransaction({
              id: coreTransaction.id,
              origin: fields.origin,
              destination: fields.destination,
              class: fields.flightClass,
            }),
          injector.get(BusinessTripEmployeePaymentsProvider).insertBusinessTripEmployeePayment({
            businessTripTransactionId: coreTransaction.id,
            chargeId,
            date: fields.date,
            valueDate: fields.valueDate,
            amount: fields.amount,
            currency: fields.currency,
            employeeBusinessId: fields.employeeBusinessId,
          }),
        ]);

        return coreTransaction.id;
      } catch (e) {
        console.error(`Error adding new business trip flight transaction`, e);
        throw new GraphQLError('Error adding new business trip flight transaction');
      }
    },
    addBusinessTripAccommodationsTransaction: async (_, { fields }, { injector }) => {
      try {
        const coreTransactionPromise = injector
          .get(BusinessTripTransactionsProvider)
          .insertBusinessTripTransaction({
            businessTripId: fields.businessTripId,
            category: 'ACCOMMODATION',
          })
          .then(res => res[0]);

        const chargeGenerationPromise = generateChargeForEmployeePayment(
          injector,
          fields.businessTripId,
        );

        const [coreTransaction, chargeId] = await Promise.all([
          coreTransactionPromise,
          chargeGenerationPromise,
        ]);

        await Promise.all([
          injector
            .get(BusinessTripAccommodationsTransactionsProvider)
            .insertBusinessTripAccommodationsTransaction({
              id: coreTransaction.id,
              country: fields.country,
              nightsCount: fields.nightsCount,
            }),
          injector.get(BusinessTripEmployeePaymentsProvider).insertBusinessTripEmployeePayment({
            businessTripTransactionId: coreTransaction.id,
            chargeId,
            date: fields.date,
            valueDate: fields.valueDate,
            amount: fields.amount,
            currency: fields.currency,
            employeeBusinessId: fields.employeeBusinessId,
          }),
        ]);

        return coreTransaction.id;
      } catch (e) {
        console.error(`Error adding new business trip accommodation transaction`, e);
        throw new GraphQLError('Error adding new business trip accommodation transaction');
      }
    },
    addBusinessTripOtherTransaction: async (_, { fields }, { injector }) => {
      try {
        const coreTransactionPromise = injector
          .get(BusinessTripTransactionsProvider)
          .insertBusinessTripTransaction({
            businessTripId: fields.businessTripId,
            category: 'OTHER',
          })
          .then(res => res[0]);

        const chargeGenerationPromise = generateChargeForEmployeePayment(
          injector,
          fields.businessTripId,
        );

        const [coreTransaction, chargeId] = await Promise.all([
          coreTransactionPromise,
          chargeGenerationPromise,
        ]);

        await Promise.all([
          injector.get(BusinessTripOtherTransactionsProvider).insertBusinessTripOtherTransaction({
            id: coreTransaction.id,
            description: fields.description,
            deductibleExpense: fields.deductibleExpense,
          }),
          injector.get(BusinessTripEmployeePaymentsProvider).insertBusinessTripEmployeePayment({
            businessTripTransactionId: coreTransaction.id,
            chargeId,
            date: fields.date,
            valueDate: fields.valueDate,
            amount: fields.amount,
            currency: fields.currency,
            employeeBusinessId: fields.employeeBusinessId,
          }),
        ]);

        return coreTransaction.id;
      } catch (e) {
        console.error(`Error adding new business trip other transaction`, e);
        throw new GraphQLError('Error adding new business trip other transaction');
      }
    },
    addBusinessTripTravelAndSubsistenceTransaction: async (_, { fields }, { injector }) => {
      try {
        const coreTransactionPromise = injector
          .get(BusinessTripTransactionsProvider)
          .insertBusinessTripTransaction({
            businessTripId: fields.businessTripId,
            category: 'FLIGHT',
          })
          .then(res => res[0]);

        const chargeGenerationPromise = generateChargeForEmployeePayment(
          injector,
          fields.businessTripId,
        );

        const [coreTransaction, chargeId] = await Promise.all([
          coreTransactionPromise,
          chargeGenerationPromise,
        ]);

        await Promise.all([
          injector
            .get(BusinessTripTravelAndSubsistenceTransactionsProvider)
            .insertBusinessTripTravelAndSubsistenceTransaction({
              id: coreTransaction.id,
              expenseType: fields.expenseType,
            }),
          injector.get(BusinessTripEmployeePaymentsProvider).insertBusinessTripEmployeePayment({
            businessTripTransactionId: coreTransaction.id,
            chargeId,
            date: fields.date,
            valueDate: fields.valueDate,
            amount: fields.amount,
            currency: fields.currency,
            employeeBusinessId: fields.employeeBusinessId,
          }),
        ]);

        return coreTransaction.id;
      } catch (e) {
        console.error(`Error adding new business trip travel & subsistence transaction`, e);
        throw new GraphQLError('Error adding new business trip travel & subsistence transaction');
      }
    },
  },
  BusinessTripAccommodationTransaction: {
    __isTypeOf: DbTransaction => DbTransaction.category === 'ACCOMMODATION',
    ...commonBusinessTripTransactionFields,
    country: dbTransaction => dbTransaction.country,
    nightsCount: dbTransaction => dbTransaction.nights_count,
  },
  BusinessTripFlightTransaction: {
    __isTypeOf: DbTransaction => DbTransaction.category === 'FLIGHT',
    ...commonBusinessTripTransactionFields,
    origin: dbTransaction => dbTransaction.origin,
    destination: dbTransaction => dbTransaction.destination,
    class: dbTransaction => dbTransaction.class,
  },
  BusinessTripTravelAndSubsistenceTransaction: {
    __isTypeOf: DbTransaction => DbTransaction.category === 'TRAVEL_AND_SUBSISTENCE',
    ...commonBusinessTripTransactionFields,
    expenseType: dbTransaction => dbTransaction.expense_type,
  },
  BusinessTripOtherTransaction: {
    __isTypeOf: DbTransaction => DbTransaction.category === 'OTHER',
    ...commonBusinessTripTransactionFields,
    description: dbTransaction => dbTransaction.description,
  },
};
