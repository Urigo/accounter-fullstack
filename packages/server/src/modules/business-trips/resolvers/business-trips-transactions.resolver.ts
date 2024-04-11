import { GraphQLError } from 'graphql';
import { BusinessTripAccommodationsTransactionsProvider } from '../providers/business-trips-transactions-accommodations.provider.js';
import { BusinessTripFlightsTransactionsProvider } from '../providers/business-trips-transactions-flights.provider.js';
import { BusinessTripOtherTransactionsProvider } from '../providers/business-trips-transactions-other.provider.js';
import { BusinessTripTravelAndSubsistenceTransactionsProvider } from '../providers/business-trips-transactions-travel-and-subsistence.provider.js';
import { BusinessTripTransactionsProvider } from '../providers/business-trips-transactions.provider.js';
import type { BusinessTripsModule } from '../types.js';

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
  },
};
