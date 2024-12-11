import { GraphQLError } from 'graphql';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { BusinessTripAttendeeStayInput } from '@shared/gql-types';
import {
  coreExpenseUpdate,
  createTravelAndSubsistenceExpense,
  generateChargeForEmployeePayment,
  updateExistingTripExpense,
} from '../helpers/business-trips-expenses.helper.js';
import { BusinessTripAttendeesProvider } from '../providers/business-trips-attendees.provider.js';
import { BusinessTripEmployeePaymentsProvider } from '../providers/business-trips-employee-payments.provider.js';
import { BusinessTripAccommodationsExpensesProvider } from '../providers/business-trips-expenses-accommodations.provider.js';
import { BusinessTripCarRentalExpensesProvider } from '../providers/business-trips-expenses-car-rental.provider.js';
import { BusinessTripFlightsExpensesProvider } from '../providers/business-trips-expenses-flights.provider.js';
import { BusinessTripOtherExpensesProvider } from '../providers/business-trips-expenses-other.provider.js';
import { BusinessTripExpensesTransactionsMatchProvider } from '../providers/business-trips-expenses-transactions-match.provider.js';
import { BusinessTripTravelAndSubsistenceExpensesProvider } from '../providers/business-trips-expenses-travel-and-subsistence.provider.js';
import { BusinessTripExpensesProvider } from '../providers/business-trips-expenses.provider.js';
import type { BusinessTripsModule } from '../types.js';
import { commonBusinessTripExpenseFields } from './common.js';
import { creditShareholdersBusinessTripTravelAndSubsistence } from './credit-shareholders-business-trip-travel-and-subsistence.resolver.js';

export const businessTripExpensesResolvers: BusinessTripsModule.Resolvers = {
  Mutation: {
    categorizeBusinessTripExpense: async (
      _,
      { fields: { businessTripId, transactionId, category, amount } },
      { injector },
    ) => {
      try {
        if (!category) {
          throw new GraphQLError(`Category is required`);
        }

        const [businessTripExpense] = await injector
          .get(BusinessTripExpensesProvider)
          .insertBusinessTripExpense({
            businessTripId,
            category,
          });
        const id = businessTripExpense.id;

        if (!amount) {
          const transaction = await injector
            .get(TransactionsProvider)
            .getTransactionByIdLoader.load(transactionId);
          if (transaction?.amount) {
            amount = Number(transaction.amount);
          }
        }

        await updateExistingTripExpense(injector, id, transactionId, category, amount);

        return id;
      } catch (e) {
        console.error(`Error updating business trip expense's category`, e);
        throw new GraphQLError("Error updating charge's business trip");
      }
    },
    categorizeIntoExistingBusinessTripExpense: async (
      _,
      { fields: { businessTripExpenseId, transactionId, amount } },
      { injector },
    ) => {
      try {
        if (!transactionId) {
          throw new GraphQLError(`Expense ID is required`);
        }

        const businessTripExpense = await injector
          .get(BusinessTripExpensesProvider)
          .getBusinessTripsExpensesByIdLoader.load(businessTripExpenseId);

        if (!businessTripExpense) {
          throw new GraphQLError(
            `Business trip expense with id ${businessTripExpenseId} not found`,
          );
        }

        await injector
          .get(BusinessTripExpensesTransactionsMatchProvider)
          .insertBusinessTripExpenseMatch({
            businessTripExpenseId,
            transactionId,
            amount,
          });

        return businessTripExpense.id!;
      } catch (e) {
        console.error(`Error updating business trip expense's category`, e);
        throw new GraphQLError("Error updating charge's business trip");
      }
    },
    updateBusinessTripFlightsExpense: async (_, { fields }, { injector }) => {
      try {
        const coreExpenseUpdatePromise = coreExpenseUpdate(injector, fields, 'FLIGHT');

        const { id, origin, destination, flightClass, attendeeIds } = fields;
        const hasFlightFieldsToUpdate = origin || destination || flightClass || attendeeIds?.length;
        const flightExpenseUpdate = hasFlightFieldsToUpdate
          ? injector.get(BusinessTripFlightsExpensesProvider).updateBusinessTripFlightsExpense({
              businessTripExpenseId: id,
              origin,
              destination,
              class: flightClass,
              attendeeIds: fields.attendeeIds as string[] | undefined,
            })
          : Promise.resolve();

        await Promise.all([coreExpenseUpdatePromise, flightExpenseUpdate]);

        return id;
      } catch (e) {
        console.error(`Error updating business trip flight expense`, e);
        throw new GraphQLError('Error updating business trip flight expense');
      }
    },
    updateBusinessTripAccommodationsExpense: async (_, { fields }, { injector }) => {
      try {
        const coreExpenseUpdatePromise = coreExpenseUpdate(injector, fields, 'ACCOMMODATION');

        const { id, country, nightsCount, attendeesStay } = fields;
        const hasAccommodationFieldsToUpdate = country || nightsCount || attendeesStay;
        const accommodationExpenseUpdate = hasAccommodationFieldsToUpdate
          ? injector
              .get(BusinessTripAccommodationsExpensesProvider)
              .updateBusinessTripAccommodationsExpense({
                businessTripExpenseId: id,
                country,
                nightsCount,
                attendeesStay: fields.attendeesStay as BusinessTripAttendeeStayInput[] | undefined,
              })
          : Promise.resolve();

        await Promise.all([coreExpenseUpdatePromise, accommodationExpenseUpdate]);

        return id;
      } catch (e) {
        console.error(`Error updating business trip accommodations expense`, e);
        throw new GraphQLError('Error updating business trip accommodations expense');
      }
    },
    updateBusinessTripOtherExpense: async (_, { fields }, { injector }) => {
      try {
        const coreExpenseUpdatePromise = coreExpenseUpdate(injector, fields, 'OTHER');

        const { id, description, deductibleExpense } = fields;
        const hasOtherFieldsToUpdate = description || deductibleExpense != null;
        const otherExpenseUpdate = hasOtherFieldsToUpdate
          ? injector.get(BusinessTripOtherExpensesProvider).updateBusinessTripOtherExpense({
              businessTripExpenseId: id,
              description,
              deductibleExpense,
            })
          : Promise.resolve();

        await Promise.all([coreExpenseUpdatePromise, otherExpenseUpdate]);

        return id;
      } catch (e) {
        console.error(`Error updating business trip other expense`, e);
        throw new GraphQLError('Error updating business trip other expense');
      }
    },
    updateBusinessTripTravelAndSubsistenceExpense: async (_, { fields }, { injector }) => {
      try {
        const coreExpenseUpdatePromise = coreExpenseUpdate(
          injector,
          fields,
          'TRAVEL_AND_SUBSISTENCE',
        );

        const { id, expenseType } = fields;
        const hasTravelAndSubsistenceFieldsToUpdate = expenseType;
        const travelAndSubsistenceExpenseUpdate = hasTravelAndSubsistenceFieldsToUpdate
          ? injector
              .get(BusinessTripTravelAndSubsistenceExpensesProvider)
              .updateBusinessTripTravelAndSubsistenceExpense({
                businessTripExpenseId: id,
                expenseType,
              })
          : Promise.resolve();

        await Promise.all([coreExpenseUpdatePromise, travelAndSubsistenceExpenseUpdate]);

        return id;
      } catch (e) {
        console.error(`Error updating business trip travel&subsistence expense`, e);
        throw new GraphQLError('Error updating business trip travel&subsistence expense');
      }
    },
    updateBusinessTripCarRentalExpense: async (_, { fields }, { injector }) => {
      try {
        const coreExpenseUpdatePromise = coreExpenseUpdate(injector, fields, 'CAR_RENTAL');

        const { id, days, isFuelExpense } = fields;
        const hasCarRentalFieldsToUpdate = isFuelExpense != null || days != null;
        const carRentalExpenseUpdate = hasCarRentalFieldsToUpdate
          ? injector.get(BusinessTripCarRentalExpensesProvider).updateBusinessTripCarRentalExpense({
              businessTripExpenseId: id,
              days,
              isFuelExpense,
            })
          : Promise.resolve();

        await Promise.all([coreExpenseUpdatePromise, carRentalExpenseUpdate]);

        return id;
      } catch (e) {
        console.error(`Error updating business trip car rental expense`, e);
        throw new GraphQLError('Error updating business trip car rental expense');
      }
    },
    deleteBusinessTripExpense: async (_, { businessTripExpenseId }, { injector }) => {
      try {
        await Promise.all([
          injector
            .get(BusinessTripFlightsExpensesProvider)
            .deleteBusinessTripFlightsExpense({ businessTripExpenseId }),
          injector
            .get(BusinessTripAccommodationsExpensesProvider)
            .deleteBusinessTripAccommodationsExpense({ businessTripExpenseId }),
          injector
            .get(BusinessTripOtherExpensesProvider)
            .deleteBusinessTripOtherExpense({ businessTripExpenseId }),
          injector
            .get(BusinessTripTravelAndSubsistenceExpensesProvider)
            .deleteBusinessTripTravelAndSubsistenceExpense({ businessTripExpenseId }),
          injector.get(BusinessTripEmployeePaymentsProvider).deleteBusinessTripEmployeePayment({
            businessTripExpenseId,
          }),
          injector
            .get(BusinessTripExpensesTransactionsMatchProvider)
            .deleteBusinessTripExpenseMatch({ businessTripExpenseId }),
        ]);

        // core expense must be deleted AFTER all extensions were dropped
        await injector
          .get(BusinessTripExpensesProvider)
          .deleteBusinessTripExpense({ businessTripExpenseId });

        return true;
      } catch (e) {
        console.error(`Error deleting business trip expense`, e);
        throw new GraphQLError('Error deleting business trip expense');
      }
    },
    uncategorizePartialBusinessTripExpense: async (
      _,
      { transactionId, businessTripExpenseId },
      { injector },
    ) => {
      try {
        await Promise.all([
          injector
            .get(BusinessTripFlightsExpensesProvider)
            .deleteBusinessTripFlightsExpense({ businessTripExpenseId }),
          injector
            .get(BusinessTripAccommodationsExpensesProvider)
            .deleteBusinessTripAccommodationsExpense({ businessTripExpenseId }),
          injector
            .get(BusinessTripOtherExpensesProvider)
            .deleteBusinessTripOtherExpense({ businessTripExpenseId }),
          injector
            .get(BusinessTripTravelAndSubsistenceExpensesProvider)
            .deleteBusinessTripTravelAndSubsistenceExpense({ businessTripExpenseId }),
          injector.get(BusinessTripEmployeePaymentsProvider).deleteBusinessTripEmployeePayment({
            businessTripExpenseId,
          }),
          injector
            .get(BusinessTripExpensesTransactionsMatchProvider)
            .deleteSpecificBusinessTripExpenseMatch({
              businessTripExpenseId,
              transactionId,
            }),
        ]);

        return true;
      } catch (e) {
        console.error(`Error deleting business trip expense part`, e);
        throw new GraphQLError('Error deleting business trip expense part');
      }
    },
    addBusinessTripFlightsExpense: async (_, { fields }, { injector }) => {
      try {
        const coreExpensePromise = injector
          .get(BusinessTripExpensesProvider)
          .insertBusinessTripExpense({
            businessTripId: fields.businessTripId,
            category: 'FLIGHT',
          })
          .then(res => res[0]);

        const chargeGenerationPromise = generateChargeForEmployeePayment(
          injector,
          fields.businessTripId,
        );

        const [coreExpense, chargeId] = await Promise.all([
          coreExpensePromise,
          chargeGenerationPromise,
        ]);

        await Promise.all([
          injector.get(BusinessTripFlightsExpensesProvider).insertBusinessTripFlightsExpense({
            id: coreExpense.id,
            origin: fields.origin,
            destination: fields.destination,
            class: fields.flightClass,
            attendeeIds: fields.attendeeIds as string[] | undefined,
          }),
          injector.get(BusinessTripEmployeePaymentsProvider).insertBusinessTripEmployeePayment({
            businessTripExpenseId: coreExpense.id,
            chargeId,
            date: fields.date,
            valueDate: fields.valueDate,
            amount: fields.amount,
            currency: fields.currency,
            employeeBusinessId: fields.employeeBusinessId,
          }),
        ]);

        return coreExpense.id;
      } catch (e) {
        console.error(`Error adding new business trip flight expense`, e);
        throw new GraphQLError('Error adding new business trip flight expense');
      }
    },
    addBusinessTripAccommodationsExpense: async (_, { fields }, { injector }) => {
      try {
        const coreExpensePromise = injector
          .get(BusinessTripExpensesProvider)
          .insertBusinessTripExpense({
            businessTripId: fields.businessTripId,
            category: 'ACCOMMODATION',
          })
          .then(res => res[0]);

        const chargeGenerationPromise = generateChargeForEmployeePayment(
          injector,
          fields.businessTripId,
        );

        const [coreExpense, chargeId] = await Promise.all([
          coreExpensePromise,
          chargeGenerationPromise,
        ]);

        await Promise.all([
          injector
            .get(BusinessTripAccommodationsExpensesProvider)
            .insertBusinessTripAccommodationsExpense({
              id: coreExpense.id,
              country: fields.country,
              nightsCount: fields.nightsCount,
              attendeesStay: fields.attendeesStay as BusinessTripAttendeeStayInput[] | undefined,
            }),
          injector.get(BusinessTripEmployeePaymentsProvider).insertBusinessTripEmployeePayment({
            businessTripExpenseId: coreExpense.id,
            chargeId,
            date: fields.date,
            valueDate: fields.valueDate,
            amount: fields.amount,
            currency: fields.currency,
            employeeBusinessId: fields.employeeBusinessId,
          }),
        ]);

        return coreExpense.id;
      } catch (e) {
        console.error(`Error adding new business trip accommodation expense`, e);
        throw new GraphQLError('Error adding new business trip accommodation expense');
      }
    },
    addBusinessTripOtherExpense: async (_, { fields }, { injector }) => {
      try {
        const coreExpensePromise = injector
          .get(BusinessTripExpensesProvider)
          .insertBusinessTripExpense({
            businessTripId: fields.businessTripId,
            category: 'OTHER',
          })
          .then(res => res[0]);

        const chargeGenerationPromise = generateChargeForEmployeePayment(
          injector,
          fields.businessTripId,
        );

        const [coreExpense, chargeId] = await Promise.all([
          coreExpensePromise,
          chargeGenerationPromise,
        ]);

        await Promise.all([
          injector.get(BusinessTripOtherExpensesProvider).insertBusinessTripOtherExpense({
            id: coreExpense.id,
            description: fields.description,
            deductibleExpense: fields.deductibleExpense,
          }),
          injector.get(BusinessTripEmployeePaymentsProvider).insertBusinessTripEmployeePayment({
            businessTripExpenseId: coreExpense.id,
            chargeId,
            date: fields.date,
            valueDate: fields.valueDate,
            amount: fields.amount,
            currency: fields.currency,
            employeeBusinessId: fields.employeeBusinessId,
          }),
        ]);

        return coreExpense.id;
      } catch (e) {
        console.error(`Error adding new business trip other expense`, e);
        throw new GraphQLError('Error adding new business trip other expense');
      }
    },
    addBusinessTripTravelAndSubsistenceExpense: async (_, { fields }, { injector }) =>
      createTravelAndSubsistenceExpense(injector, fields),
    addBusinessTripCarRentalExpense: async (_, { fields }, { injector }) => {
      try {
        const coreExpensePromise = injector
          .get(BusinessTripExpensesProvider)
          .insertBusinessTripExpense({
            businessTripId: fields.businessTripId,
            category: 'CAR_RENTAL',
          })
          .then(res => res[0]);

        const chargeGenerationPromise = generateChargeForEmployeePayment(
          injector,
          fields.businessTripId,
        );

        const [coreExpense, chargeId] = await Promise.all([
          coreExpensePromise,
          chargeGenerationPromise,
        ]);

        await Promise.all([
          injector.get(BusinessTripCarRentalExpensesProvider).insertBusinessTripCarRentalExpense({
            id: coreExpense.id,
            days: fields.days ?? 0,
            isFuelExpense: fields.isFuelExpense ?? false,
          }),
          injector.get(BusinessTripEmployeePaymentsProvider).insertBusinessTripEmployeePayment({
            businessTripExpenseId: coreExpense.id,
            chargeId,
            date: fields.date,
            valueDate: fields.valueDate,
            amount: fields.amount,
            currency: fields.currency,
            employeeBusinessId: fields.employeeBusinessId,
          }),
        ]);

        return coreExpense.id;
      } catch (e) {
        console.error(`Error adding new business trip car rental expense`, e);
        throw new GraphQLError('Error adding new business trip car rental expense');
      }
    },
    creditShareholdersBusinessTripTravelAndSubsistence,
  },
  BusinessTripAccommodationExpense: {
    __isTypeOf: DbExpense => DbExpense.category === 'ACCOMMODATION',
    ...commonBusinessTripExpenseFields,
    country: dbExpense => dbExpense.country,
    nightsCount: dbExpense => dbExpense.nights_count,
    attendeesStay: async (dbExpense, _, { injector }) => {
      if (dbExpense.attendees_stay.length === 0 || !dbExpense.business_trip_id) {
        return [];
      }
      const attendeesStay = dbExpense.attendees_stay.filter(
        Boolean,
      ) as BusinessTripAttendeeStayInput[];
      const attendeesStayIds = attendeesStay.map(({ attendeeId }) => attendeeId);
      const attendees = await injector
        .get(BusinessTripAttendeesProvider)
        .getBusinessTripsAttendeesByBusinessTripIdLoader.load(dbExpense.business_trip_id);
      return attendees
        .filter(attendee => attendeesStayIds.includes(attendee.id))
        .map(attendee => ({
          id: attendee.id,
          attendee,
          nightsCount:
            attendeesStay.find(({ attendeeId }) => attendeeId === attendee.id)?.nightsCount ?? 0,
        }));
    },
  },
  BusinessTripFlightExpense: {
    __isTypeOf: DbExpense => DbExpense.category === 'FLIGHT',
    ...commonBusinessTripExpenseFields,
    origin: dbExpense => dbExpense.origin,
    destination: dbExpense => dbExpense.destination,
    class: dbExpense => dbExpense.class,
    attendees: async (dbExpense, _, { injector }) => {
      if (dbExpense.attendees.length === 0 || !dbExpense.business_trip_id) {
        return [];
      }
      const attendees = await injector
        .get(BusinessTripAttendeesProvider)
        .getBusinessTripsAttendeesByBusinessTripIdLoader.load(dbExpense.business_trip_id);
      return attendees.filter(attendee => dbExpense.attendees.includes(attendee.id));
    },
  },
  BusinessTripTravelAndSubsistenceExpense: {
    __isTypeOf: DbExpense => DbExpense.category === 'TRAVEL_AND_SUBSISTENCE',
    ...commonBusinessTripExpenseFields,
    expenseType: dbExpense => dbExpense.expense_type,
  },
  BusinessTripCarRentalExpense: {
    __isTypeOf: DbExpense => DbExpense.category === 'CAR_RENTAL',
    ...commonBusinessTripExpenseFields,
    days: dbExpense => dbExpense.days,
    isFuelExpense: dbExpense => dbExpense.is_fuel_expense,
  },
  BusinessTripOtherExpense: {
    __isTypeOf: DbExpense => DbExpense.category === 'OTHER',
    ...commonBusinessTripExpenseFields,
    description: dbExpense => dbExpense.description,
  },
};
