import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { BusinessTripAccommodationsTransactionsProvider } from '../providers/business-trips-transactions-accommodations.provider.js';
import { BusinessTripFlightsTransactionsProvider } from '../providers/business-trips-transactions-flights.provider.js';
import { BusinessTripOtherTransactionsProvider } from '../providers/business-trips-transactions-other.provider.js';
import { BusinessTripTravelAndSubsistenceTransactionsProvider } from '../providers/business-trips-transactions-travel-and-subsistence.provider.js';
import { BusinessTripTransactionsProvider } from '../providers/business-trips-transactions.provider.js';
import type { BusinessTripsModule, IUpdateBusinessTripTransactionParams } from '../types.js';

async function coreTransactionUpdate(
  injector: Injector,
  fields: IUpdateBusinessTripTransactionParams & { id: string },
) {
  const { id, businessTripId, date, valueDate, amount, currency, employeeBusinessId } = fields;
  const [currentTransaction] = await injector
    .get(BusinessTripTransactionsProvider)
    .getBusinessTripsTransactionsByIdLoader.load(id);

  if (!currentTransaction) {
    throw new GraphQLError(`Business trip transaction with id ${id} not found`);
  }
  if (currentTransaction.category !== 'FLIGHT') {
    throw new GraphQLError(`Business trip transaction with id ${id} is not a flight transaction`);
  }

  const hasCommonFieldsToUpdate =
    businessTripId || date || valueDate || amount || currency || employeeBusinessId;
  return hasCommonFieldsToUpdate
    ? injector.get(BusinessTripTransactionsProvider).updateBusinessTripTransaction({
        businessTripTransactionId: id,
        businessTripId,
        ...(currentTransaction.payed_by_employee
          ? {
              date,
              valueDate,
              currency,
              employeeBusinessId,
            }
          : {}),
      })
    : Promise.resolve();
}

export const businessTripTransactionsResolvers: BusinessTripsModule.Resolvers = {
  Mutation: {
    updateBusinessTripTransactionCategory: async (
      _,
      { fields: { businessTripId, transactionId, category } },
      { injector },
    ) => {
      try {
        if (!category) {
          return null;
        }

        const [businessTripTransaction] = await injector
          .get(BusinessTripTransactionsProvider)
          .insertBusinessTripTransaction({
            businessTripId,
            transactionId,
            payedByEmployee: false,
            category,
          });
        const id = businessTripTransaction.id;
        switch (category) {
          case 'FLIGHT':
            await injector
              .get(BusinessTripFlightsTransactionsProvider)
              .insertBusinessTripFlightTransaction({
                id,
              });
            break;
          case 'ACCOMMODATION':
            await injector
              .get(BusinessTripAccommodationsTransactionsProvider)
              .insertBusinessTripAccommodationTransaction({
                id,
              });
            break;
          case 'TRAVEL_AND_SUBSISTENCE':
            await injector
              .get(BusinessTripTravelAndSubsistenceTransactionsProvider)
              .insertBusinessTripTravelAndSubsistenceTransaction({ id });
            break;
          case 'OTHER':
            await injector
              .get(BusinessTripOtherTransactionsProvider)
              .insertBusinessTripOtherTransaction({
                id,
              });
            break;
          default:
            throw new GraphQLError(`Invalid category ${category}`);
        }
        return id;
      } catch (e) {
        console.error(`Error updating business trip transaction's category`, e);
        throw new GraphQLError((e as Error)?.message ?? `Error updating charge's business trip`);
      }
    },
    updateBusinessTripFlightTransaction: async (_, { fields }, { injector }) => {
      try {
        const coreTransactionUpdatePromise = coreTransactionUpdate(injector, fields);

        const { id, origin, destination, flightClass } = fields;
        const hasFlightFliedsToUpdate = origin || destination || flightClass;
        const flightTransactionUpdate = hasFlightFliedsToUpdate
          ? injector
              .get(BusinessTripFlightsTransactionsProvider)
              .updateBusinessTripFlightTransaction({
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
        throw new GraphQLError(
          (e as Error)?.message ?? `Error updating business trip flight transaction`,
        );
      }
    },
    updateBusinessTripAccommodationTransaction: async (_, { fields }, { injector }) => {
      try {
        const coreTransactionUpdatePromise = coreTransactionUpdate(injector, fields);

        const { id, country, nightsCount } = fields;
        const hasAccommodationFieldsToUpdate = country || nightsCount;
        const accommodationTransactionUpdate = hasAccommodationFieldsToUpdate
          ? injector
              .get(BusinessTripAccommodationsTransactionsProvider)
              .updateBusinessTripAccommodationTransaction({
                businessTripTransactionId: id,
                country,
                nightsCount,
              })
          : Promise.resolve();

        await Promise.all([coreTransactionUpdatePromise, accommodationTransactionUpdate]);

        return id;
      } catch (e) {
        console.error(`Error updating business trip accommodations transaction`, e);
        throw new GraphQLError(
          (e as Error)?.message ?? `Error updating business trip accommodations transaction`,
        );
      }
    },
    updateBusinessTripOtherTransaction: async (_, { fields }, { injector }) => {
      try {
        const coreTransactionUpdatePromise = coreTransactionUpdate(injector, fields);

        const { id, expenseType, deductibleExpense } = fields;
        const hasOtherFieldsToUpdate = expenseType || deductibleExpense != null;
        const otherTransactionUpdate = hasOtherFieldsToUpdate
          ? injector.get(BusinessTripOtherTransactionsProvider).updateBusinessTripOtherTransaction({
              businessTripTransactionId: id,
              expenseType,
              deductibleExpense,
            })
          : Promise.resolve();

        await Promise.all([coreTransactionUpdatePromise, otherTransactionUpdate]);

        return id;
      } catch (e) {
        console.error(`Error updating business trip other transaction`, e);
        throw new GraphQLError(
          (e as Error)?.message ?? `Error updating business trip other transaction`,
        );
      }
    },
    updateBusinessTripTravelAndSubsistenceTransaction: async (_, { fields }, { injector }) => {
      try {
        const coreTransactionUpdatePromise = coreTransactionUpdate(injector, fields);

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
        throw new GraphQLError(
          (e as Error)?.message ?? `Error updating business trip travel&subsistence transaction`,
        );
      }
    },
    deleteBusinessTripTransaction: async (_, { businessTripTransactionId }, { injector }) => {
      try {
        await Promise.all([
          injector
            .get(BusinessTripTransactionsProvider)
            .deleteBusinessTripTransaction({ businessTripTransactionId }),
          injector
            .get(BusinessTripFlightsTransactionsProvider)
            .deleteBusinessTripFlightTransaction({ businessTripTransactionId }),
          injector
            .get(BusinessTripAccommodationsTransactionsProvider)
            .deleteBusinessTripAccommodationTransaction({ businessTripTransactionId }),
          injector
            .get(BusinessTripOtherTransactionsProvider)
            .deleteBusinessTripOtherTransaction({ businessTripTransactionId }),
          injector
            .get(BusinessTripTravelAndSubsistenceTransactionsProvider)
            .deleteBusinessTripTravelAndSubsistenceTransaction({ businessTripTransactionId }),
        ]);

        return true;
      } catch (e) {
        console.error(`Error deleting business trip transaction`, e);
        throw new GraphQLError((e as Error)?.message ?? `Error deleting business trip transaction`);
      }
    },
    addBusinessTripFlightTransaction: async (_, { fields }, { injector }) => {
      try {
        const [coreTransaction] = await injector
          .get(BusinessTripTransactionsProvider)
          .insertBusinessTripTransaction({
            ...fields,
            category: 'FLIGHT',
            payedByEmployee: true,
          });

        await injector
          .get(BusinessTripFlightsTransactionsProvider)
          .insertBusinessTripFlightTransaction({
            id: coreTransaction.id,
            origin: fields.origin,
            destination: fields.destination,
            class: fields.flightClass,
          });

        return coreTransaction.id;
      } catch (e) {
        console.error(`Error adding new business trip flight transaction`, e);
        throw new GraphQLError(
          (e as Error)?.message ?? `Error adding new business trip flight transaction`,
        );
      }
    },
    addBusinessTripAccommodationTransaction: async (_, { fields }, { injector }) => {
      try {
        const [coreTransaction] = await injector
          .get(BusinessTripTransactionsProvider)
          .insertBusinessTripTransaction({
            ...fields,
            category: 'ACCOMMODATION',
            payedByEmployee: true,
          });

        await injector
          .get(BusinessTripAccommodationsTransactionsProvider)
          .insertBusinessTripAccommodationTransaction({
            id: coreTransaction.id,
            country: fields.country,
            nightsCount: fields.nightsCount,
          });

        return coreTransaction.id;
      } catch (e) {
        console.error(`Error adding new business trip accommodation transaction`, e);
        throw new GraphQLError(
          (e as Error)?.message ?? `Error adding new business trip accommodation transaction`,
        );
      }
    },
    addBusinessTripOtherTransaction: async (_, { fields }, { injector }) => {
      try {
        const [coreTransaction] = await injector
          .get(BusinessTripTransactionsProvider)
          .insertBusinessTripTransaction({
            ...fields,
            category: 'OTHER',
            payedByEmployee: true,
          });

        await injector
          .get(BusinessTripOtherTransactionsProvider)
          .insertBusinessTripOtherTransaction({
            id: coreTransaction.id,
            expenseType: fields.expenseType,
            deductibleExpense: fields.deductibleExpense,
          });

        return coreTransaction.id;
      } catch (e) {
        console.error(`Error adding new business trip other transaction`, e);
        throw new GraphQLError(
          (e as Error)?.message ?? `Error adding new business trip other transaction`,
        );
      }
    },
    addBusinessTripTravelAndSubsistenceTransaction: async (_, { fields }, { injector }) => {
      try {
        const [coreTransaction] = await injector
          .get(BusinessTripTransactionsProvider)
          .insertBusinessTripTransaction({
            ...fields,
            category: 'FLIGHT',
            payedByEmployee: true,
          });

        await injector
          .get(BusinessTripTravelAndSubsistenceTransactionsProvider)
          .insertBusinessTripTravelAndSubsistenceTransaction({
            id: coreTransaction.id,
            expenseType: fields.expenseType,
          });

        return coreTransaction.id;
      } catch (e) {
        console.error(`Error adding new business trip travel & subsistence transaction`, e);
        throw new GraphQLError(
          (e as Error)?.message ??
            `Error adding new business trip travel & subsistence transaction`,
        );
      }
    },
  },
};
