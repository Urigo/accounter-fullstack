import { differenceInDays } from 'date-fns';
import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { EmployeesProvider } from '@modules/salaries/providers/employees.provider.js';
import type { IGetEmployeesByIdResult } from '@modules/salaries/types';
import { DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY } from '@shared/constants';
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
  IGetBusinessTripsTravelAndSubsistenceExpensesByChargeIdsResult,
} from '../types.js';
import { businessTripSummary } from './business-trip-summary.resolver.js';

export const creditShareholdersBusinessTripTravelAndSubsistence: Resolver<
  readonly ResolverTypeWrapper<string>[],
  unknown,
  GraphQLModules.Context,
  RequireFields<MutationCreditShareholdersBusinessTripTravelAndSubsistenceArgs, 'businessTripId'>
> = async (_, { businessTripId }, { injector }) => {
  async function summaryDataPromise() {
    const businessTrip = await injector
      .get(BusinessTripsProvider)
      .getBusinessTripsByIdLoader.load(businessTripId);

    if (!businessTrip) {
      throw new GraphQLError(`Business trip with id ${businessTripId} not found`);
    }

    if (!businessTrip.to_date) {
      throw new GraphQLError(`Business trip with id ${businessTripId} is missing end date`);
    }

    const summaryData = await businessTripSummary(injector, businessTrip);

    return { businessTrip, summaryData };
  }

  const accommodationExpensesPromise = injector
    .get(BusinessTripAccommodationsExpensesProvider)
    .getBusinessTripsAccommodationsExpensesByBusinessTripIdLoader.load(businessTripId);

  const attendeePayedTnSExpensesPromise = injector
    .get(BusinessTripTravelAndSubsistenceExpensesProvider)
    .getBusinessTripsTravelAndSubsistenceExpensesByChargeIdLoader.load(businessTripId)
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

  if (!businessTrip.to_date) {
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
      injector,
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
    date: dateToTimelessDateString(businessTrip.to_date!),
    valueDate: dateToTimelessDateString(businessTrip.to_date!),
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
    return createTravelAndSubsistenceExpense(injector, {
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
  injector: Injector,
  accommodationExpenses: IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsResult[],
  shareholdersMap: Map<string, IGetEmployeesByIdResult>,
  attendeesMap: Map<string, IGetBusinessTripsAttendeesByBusinessTripIdsResult>,
  attendeePayedTnSExpenses: IGetBusinessTripsTravelAndSubsistenceExpensesByChargeIdsResult[],
  businessTrip: BusinessTripProto,
) {
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
        throw new Error(
          `Shareholder ${shareholder.first_name} is missing arrival or departure date`,
        );
      }

      const taxVariables = await injector
        .get(BusinessTripTaxVariablesProvider)
        .getTaxVariablesByDateLoader.load(businessTrip.to_date!);

      if (!taxVariables) {
        throw new GraphQLError(`Tax variables are not set for date ${businessTrip.to_date}`);
      }

      const totalNights = differenceInDays(attendee.departure, attendee.arrival);
      const accommodatedNights = shareholdersAccommodatedNightsMap.get(id) ?? 0;

      const maxTaxableAmount =
        getAttendeeTravelAndSubsistenceMaxTax(
          totalNights,
          accommodatedNights,
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

            if (expense.currency === DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY) {
              payedAmount += amount;
            } else {
              const rate = await injector
                .get(ExchangeProvider)
                .getExchangeRates(
                  currency,
                  DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY,
                  new Date(date),
                );

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
