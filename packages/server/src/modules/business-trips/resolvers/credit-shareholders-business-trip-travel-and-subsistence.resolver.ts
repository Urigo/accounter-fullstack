import { differenceInDays } from 'date-fns';
import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { EmployeesProvider } from '@modules/salaries/providers/employees.provider.js';
import type { IGetEmployeesByIdResult } from '@modules/salaries/types';
import {
  Currency,
  type AddBusinessTripTravelAndSubsistenceExpenseInput,
  type BusinessTripAttendeeStayInput,
  type MutationCreditShareholdersBusinessTripTravelAndSubsistenceArgs,
  type RequireFields,
  type Resolver,
  type ResolverTypeWrapper,
} from '@shared/gql-types';
import { dateToTimelessDateString } from '@shared/helpers';
import {
  getAttendeeTravelAndSubsistenceMaxTax,
  getExpenseCoreData,
} from '../helpers/business-trip-report.helper.js';
import { createTravelAndSubsistenceExpense } from '../helpers/business-trips-expenses.helper.js';
import { BusinessTripAttendeesProvider } from '../providers/business-trips-attendees.provider.js';
import { BusinessTripAccommodationsExpensesProvider } from '../providers/business-trips-expenses-accommodations.provider.js';
import { BusinessTripTravelAndSubsistenceExpensesProvider } from '../providers/business-trips-expenses-travel-and-subsistence.provider.js';
import { BusinessTripTaxVariablesProvider } from '../providers/business-trips-tax-variables.provider.js';
import { BusinessTripsProvider } from '../providers/business-trips.provider.js';
import type {
  BusinessTripProto,
  IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsAttendeesByBusinessTripIdsResult,
  IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsResult,
} from '../types.js';
import { businessTripSummary } from './business-trip-summary.resolver.js';

export const creditShareholdersBusinessTripTravelAndSubsistence: Resolver<
  readonly ResolverTypeWrapper<string>[],
  unknown,
  GraphQLModules.Context,
  RequireFields<MutationCreditShareholdersBusinessTripTravelAndSubsistenceArgs, 'businessTripId'>
> = async (_, { businessTripId }, context) => {
  const { injector } = context;
  async function summaryDataPromise() {
    const businessTrip = await injector
      .get(BusinessTripsProvider)
      .getBusinessTripsByIdLoader.load(businessTripId);

    if (!businessTrip) {
      throw new GraphQLError(`Business trip with id ${businessTripId} not found`);
    }

    const attendees = await injector
      .get(BusinessTripAttendeesProvider)
      .getBusinessTripsAttendeesByBusinessTripIdLoader.load(businessTripId);

    if (!attendees?.length) {
      throw new GraphQLError(`Business trip with id ${businessTripId} is missing attendees`);
    }

    let toDate: Date | undefined;

    attendees.map(({ departure }) => {
      if (departure && (!toDate || departure > toDate)) {
        toDate = departure;
      }
    });

    if (!toDate) {
      throw new GraphQLError(`Business trip with id ${businessTripId} is missing end date`);
    }

    const summaryData = await businessTripSummary(context, businessTrip);

    return { businessTrip: { ...businessTrip, toDate }, summaryData };
  }

  const accommodationExpensesPromise = injector
    .get(BusinessTripAccommodationsExpensesProvider)
    .getBusinessTripsAccommodationsExpensesByBusinessTripIdLoader.load(businessTripId);

  const attendeePayedTnSExpensesPromise = injector
    .get(BusinessTripTravelAndSubsistenceExpensesProvider)
    .getBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdLoader.load(businessTripId)
    .then(expenses => expenses.filter(expense => expense.payed_by_employee));

  const [
    { businessTrip, summaryData },
    accommodationExpenses,
    attendeePayedTnSExpenses,
    { shareholdersMap, attendeesMap },
  ] = await Promise.all([
    summaryDataPromise(),
    accommodationExpensesPromise,
    attendeePayedTnSExpensesPromise,
    shareholdersMapPromise(injector, businessTripId),
  ]);

  if (!businessTrip.toDate) {
    throw new GraphQLError(`Business trip with id ${businessTripId} is missing end date`);
  }

  if (shareholdersMap.size === 0) {
    return []; // No shareholders to distribute the credit to
  }

  async function availableAmountToDistributePromise() {
    const travelAndSubsistenceRow = await summaryData.rows.find(
      row => 'type' in row && row.type === 'TRAVEL_AND_SUBSISTENCE',
    );
    if (!travelAndSubsistenceRow) {
      throw new GraphQLError(`Travel and subsistence row not found`);
    }
    const [{ raw: taxableAmount }, { raw: maxTaxableAmount }] = await Promise.all([
      travelAndSubsistenceRow.maxTaxableForeignCurrency,
      travelAndSubsistenceRow.taxableForeignCurrency,
    ]);

    if (Number.isNaN(taxableAmount) || Number.isNaN(maxTaxableAmount)) {
      throw new GraphQLError(`Taxable amounts are missing`);
    }

    const availableAmountToDistribute = Math.max(maxTaxableAmount - taxableAmount, 0);

    return availableAmountToDistribute;
  }

  const [availableAmountToDistribute, shareholdersPotentialAmountToDistribute] = await Promise.all([
    availableAmountToDistributePromise(),
    shareholdersPotentialAmountToDistributePromise(
      context,
      accommodationExpenses,
      shareholdersMap,
      attendeesMap,
      attendeePayedTnSExpenses,
      businessTrip,
    ),
  ]);

  if (availableAmountToDistribute <= 0) {
    return []; // No available amount to distribute
  }

  const commonFields: AddBusinessTripTravelAndSubsistenceExpenseInput = {
    businessTripId,
    currency: Currency.Usd,
    date: dateToTimelessDateString(businessTrip.toDate!),
    valueDate: dateToTimelessDateString(businessTrip.toDate!),
  };

  const totalPotentialAmountToDistribute = Object.values(
    shareholdersPotentialAmountToDistribute,
  ).reduce((acc, amount) => acc + amount, 0);

  const creditRatio =
    totalPotentialAmountToDistribute <= availableAmountToDistribute
      ? 1
      : availableAmountToDistribute / totalPotentialAmountToDistribute;

  return Object.entries(shareholdersPotentialAmountToDistribute).map(([id, amount]) => {
    const shareholder = shareholdersMap.get(id)!;
    return createTravelAndSubsistenceExpense(context, {
      ...commonFields,
      amount: amount * creditRatio,
      expenseType: `${shareholder.first_name}'s travel and subsistence expenses, no invoice`,
      employeeBusinessId: id,
    });
  });
};

async function shareholdersMapPromise(injector: Injector, businessTripId: string) {
  const shareholdersMap = new Map<string, IGetEmployeesByIdResult>();
  const attendeesMap = new Map<string, IGetBusinessTripsAttendeesByBusinessTripIdsResult>();

  const attendees = await injector
    .get(BusinessTripAttendeesProvider)
    .getBusinessTripsAttendeesByBusinessTripIdLoader.load(businessTripId);

  const shareholders = await injector
    .get(EmployeesProvider)
    .getEmployeesByIdLoader.loadMany(attendees.map(a => a.id))
    .then(
      res =>
        res.filter(employee => {
          if (!employee) {
            return false;
          }
          if (employee instanceof Error) {
            throw employee;
          }
          if (employee.role_status !== 'Controlling shareholder') {
            return false;
          }

          return true;
        }) as IGetEmployeesByIdResult[],
    );

  shareholders.map(shareholder => shareholdersMap.set(shareholder.business_id, shareholder));
  attendees.map(attendee => {
    if (shareholdersMap.has(attendee.id)) {
      attendeesMap.set(attendee.id, attendee);
    }
  });

  return { shareholdersMap, attendeesMap };
}

async function shareholdersPotentialAmountToDistributePromise(
  context: GraphQLModules.Context,
  accommodationExpenses: IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsResult[],
  shareholdersMap: Map<string, IGetEmployeesByIdResult>,
  attendeesMap: Map<string, IGetBusinessTripsAttendeesByBusinessTripIdsResult>,
  attendeePayedTnSExpenses: IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsResult[],
  businessTrip: BusinessTripProto & { toDate: Date },
) {
  const {
    injector,
    adminContext: { defaultCryptoConversionFiatCurrency },
  } = context;
  const shareholdersPotentialAmountToDistribute: Record<string, number> = {};
  const shareholdersAccommodatedNightsMap = new Map<string, number>();

  // collect shareholders accommodated data
  accommodationExpenses.map(expense => {
    (expense.attendees_stay.filter(Boolean) as BusinessTripAttendeeStayInput[]).map(
      ({ attendeeId, nightsCount }) => {
        if (shareholdersMap.has(attendeeId)) {
          if (shareholdersAccommodatedNightsMap.has(attendeeId)) {
            shareholdersAccommodatedNightsMap.set(
              attendeeId,
              shareholdersAccommodatedNightsMap.get(attendeeId)! + nightsCount,
            );
          } else {
            shareholdersAccommodatedNightsMap.set(attendeeId, nightsCount);
          }
        }
      },
    );
  });

  await Promise.all(
    Array.from(shareholdersMap.entries()).map(async ([id, shareholder]) => {
      const attendee = attendeesMap.get(id);
      if (!attendee) {
        throw new Error(`Attendee with id ${id} not found, but is a shareholder`);
      }

      if (!attendee.arrival || !attendee.departure) {
        console.log(`Shareholder ${shareholder.first_name} is missing arrival or departure date`);
        return;
      }

      const taxVariables = await injector
        .get(BusinessTripTaxVariablesProvider)
        .getTaxVariablesByDateLoader.load(businessTrip.toDate);

      if (!taxVariables) {
        throw new GraphQLError(`Tax variables are not set for date ${businessTrip.toDate}`);
      }

      const totalDays = differenceInDays(attendee.departure, attendee.arrival) + 1;
      const accommodatedNights = shareholdersAccommodatedNightsMap.get(id) ?? 0;
      const unAccommodatedDays = accommodatedNights
        ? totalDays - accommodatedNights - 1
        : totalDays;

      const maxTaxableAmount =
        getAttendeeTravelAndSubsistenceMaxTax(
          totalDays,
          unAccommodatedDays,
          businessTrip.destination,
          taxVariables,
        ) * -1;

      const shareholderPayedTnSExpenses = attendeePayedTnSExpenses.filter(
        expense => expense.employee_business_id === id,
      );
      let payedAmount = 0;
      if (shareholderPayedTnSExpenses.length) {
        await Promise.all(
          shareholderPayedTnSExpenses.map(async expense => {
            const { amount, currency, date } = getExpenseCoreData(expense);

            if (expense.currency === defaultCryptoConversionFiatCurrency) {
              payedAmount += amount;
            } else {
              const rate = await injector
                .get(ExchangeProvider)
                .getExchangeRates(currency, defaultCryptoConversionFiatCurrency, new Date(date));

              payedAmount += amount * rate;
            }
          }),
        );
      }

      if (payedAmount > maxTaxableAmount) {
        return; // Shareholder already got payed more than the maximum taxable amount
      }

      shareholdersPotentialAmountToDistribute[id] = maxTaxableAmount - payedAmount;
    }),
  );

  return shareholdersPotentialAmountToDistribute;
}
