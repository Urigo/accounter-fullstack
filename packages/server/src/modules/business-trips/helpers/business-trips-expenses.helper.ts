import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import type { Injector } from 'graphql-modules';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { isSupplementalFeeTransaction } from '@modules/ledger/helpers/fee-transactions.js';
import { LedgerError } from '@modules/ledger/helpers/utils.helper.js';
import { generateLedgerRecordsForBusinessTrip } from '@modules/ledger/resolvers/ledger-generation/business-trip-ledger-generation.resolver.js';
import type { IGetExpensesByChargeIdsResult } from '@modules/misc-expenses/types.js';
import { ChargeTagsProvider } from '@modules/tags/providers/charge-tags.provider.js';
import { IGetTransactionsByChargeIdsResult } from '@modules/transactions/__generated__/transactions-new.types.js';
import type {
  AddBusinessTripTravelAndSubsistenceExpenseInput,
  BusinessTripExpenseCategories,
} from '@shared/gql-types';
import { BusinessTripEmployeePaymentsProvider } from '../providers/business-trips-employee-payments.provider.js';
import { BusinessTripAccommodationsExpensesProvider } from '../providers/business-trips-expenses-accommodations.provider.js';
import { BusinessTripCarRentalExpensesProvider } from '../providers/business-trips-expenses-car-rental.provider.js';
import { BusinessTripFlightsExpensesProvider } from '../providers/business-trips-expenses-flights.provider.js';
import { BusinessTripOtherExpensesProvider } from '../providers/business-trips-expenses-other.provider.js';
import { BusinessTripExpensesTransactionsMatchProvider } from '../providers/business-trips-expenses-transactions-match.provider.js';
import { BusinessTripTravelAndSubsistenceExpensesProvider } from '../providers/business-trips-expenses-travel-and-subsistence.provider.js';
import { BusinessTripExpensesProvider } from '../providers/business-trips-expenses.provider.js';
import { BusinessTripsProvider } from '../providers/business-trips.provider.js';
import type {
  business_trip_transaction_type,
  IGetBusinessTripsExpenseMatchesByTransactionIdsResult,
  IUpdateBusinessTripEmployeePaymentParams,
  IUpdateBusinessTripExpenseParams,
} from '../types.js';

function validateTransactionAgainstBusinessTripsExpenses(
  transaction: IGetTransactionsByChargeIdsResult,
  transactionMatchingExpenses: IGetBusinessTripsExpenseMatchesByTransactionIdsResult[],
  miscExpenses: IGetExpensesByChargeIdsResult[],
  context: GraphQLModules.Context,
): boolean {
  if (!transactionMatchingExpenses?.length && !miscExpenses?.length) {
    throw new LedgerError(
      `Transaction reference "${transaction.source_reference}" is not part of a business trip`,
    );
  }

  const totalAmount = transactionMatchingExpenses.reduce(
    (acc, expense) => acc + Number(expense.amount),
    0,
  );

  const direction = isSupplementalFeeTransaction(transaction, context) ? -1 : 1;

  const miscExpensesAmount = miscExpenses.reduce(
    (acc, expense) => Number(expense.amount) * direction + acc,
    0,
  );

  if (Math.abs(Number(transaction.amount) - miscExpensesAmount - totalAmount) > 0.005) {
    throw new LedgerError(
      `Transaction reference "${transaction.source_reference}" amount does not match the business trip expenses total amount`,
    );
  }

  return true;
}

export const validateTransactionAgainstBusinessTrips = async (
  context: GraphQLModules.Context,
  transaction: IGetTransactionsByChargeIdsResult,
): Promise<boolean> => {
  const transactionMatchingExpenses = await context.injector
    .get(BusinessTripExpensesTransactionsMatchProvider)
    .getBusinessTripsExpenseMatchesByTransactionIdLoader.load(transaction.id);

  return validateTransactionAgainstBusinessTripsExpenses(
    transaction,
    transactionMatchingExpenses,
    [],
    context,
  );
};

export const getTransactionMatchedAmount = async (
  context: GraphQLModules.Context,
  transaction: IGetTransactionsByChargeIdsResult,
): Promise<{ isFullyMatched: boolean; amount: number; errors?: string[] }> => {
  const transactionMatchingExpensesPromise = context.injector
    .get(BusinessTripExpensesTransactionsMatchProvider)
    .getBusinessTripsExpenseMatchesByTransactionIdLoader.load(transaction.id);

  const [transactionMatchingExpenses] = await Promise.all([transactionMatchingExpensesPromise]);

  const expensesSum = transactionMatchingExpenses.reduce(
    (acc, expense) => (expense.amount ? acc + Number(expense.amount) : acc),
    0,
  );

  try {
    validateTransactionAgainstBusinessTripsExpenses(
      transaction,
      transactionMatchingExpenses,
      [],
      context,
    );
  } catch (e) {
    const errors = [];
    if (e instanceof LedgerError) {
      errors.push(e.message);
    }
    return {
      isFullyMatched: false,
      amount: expensesSum,
      errors,
    };
  }

  const isFullyMatched = Math.abs(Number(transaction.amount) - expensesSum) < 0.005;

  return {
    isFullyMatched,
    amount: Number(transaction.amount),
  };
};

export async function coreExpenseUpdate(
  injector: Injector,
  fields: IUpdateBusinessTripExpenseParams &
    IUpdateBusinessTripEmployeePaymentParams & { id: string },
  categoryToValidate?: business_trip_transaction_type,
) {
  const { id, businessTripId, date, valueDate, amount, currency, employeeBusinessId, chargeId } =
    fields;
  const currentExpense = await injector
    .get(BusinessTripExpensesProvider)
    .getBusinessTripsExpensesByIdLoader.load(id);

  if (!currentExpense) {
    throw new GraphQLError(`Business trip expense with id ${id} not found`);
  }
  if (categoryToValidate && currentExpense.category !== categoryToValidate) {
    throw new GraphQLError(
      `Business trip expense with id ${id} is not a ${categoryToValidate} expense`,
    );
  }

  const updateCoreExpensePromise = async () => {
    return businessTripId
      ? injector.get(BusinessTripExpensesProvider).updateBusinessTripExpense({
          businessTripExpenseId: id,
          businessTripId,
          ...(currentExpense.payed_by_employee
            ? {
                date,
                valueDate,
                currency,
                employeeBusinessId,
              }
            : {}),
        })
      : Promise.resolve();
  };

  const updateEmployeePaymentPromise = async () => {
    const hasCommonFieldsToUpdate =
      date || valueDate || amount || currency || employeeBusinessId || chargeId;
    return hasCommonFieldsToUpdate
      ? injector.get(BusinessTripEmployeePaymentsProvider).updateBusinessTripEmployeePayment({
          businessTripExpenseId: id,
          chargeId,
          date,
          valueDate,
          currency,
          employeeBusinessId,
        })
      : Promise.resolve();
  };

  const [updatedTripExpense] = await Promise.all([
    updateCoreExpensePromise(),
    updateEmployeePaymentPromise(),
  ]);

  return updatedTripExpense;
}

export async function generateChargeForEmployeePayment(
  context: GraphQLModules.Context,
  businessTripId: string,
  description?: string,
) {
  const {
    injector,
    adminContext: {
      businessTrips: { businessTripTaxCategoryId },
      defaultAdminBusinessId,
    },
  } = context;
  if (!businessTripTaxCategoryId) {
    throw new GraphQLError('Business trip tax category not set');
  }
  try {
    const [{ id: chargeId }] = await injector.get(ChargesProvider).generateCharge({
      ownerId: defaultAdminBusinessId,
      taxCategoryId: businessTripTaxCategoryId,
      userDescription: description || 'Employee payment charge',
    });

    if (!chargeId) {
      throw new GraphQLError('Failed to generate initial charge');
    }

    await injector.get(BusinessTripsProvider).updateChargeBusinessTrip(chargeId, businessTripId);

    return chargeId;
  } catch (e) {
    console.error('Failed to generate charge for employee payment', e);
    throw new GraphQLError('Failed to generate charge for employee payment');
  }
}

export const updateExistingTripExpense = async (
  injector: Injector,
  businessTripExpenseId: string,
  transactionId: string,
  category?: BusinessTripExpenseCategories,
  amount?: number | null,
) => {
  const updateTransactionMatchPromise = injector
    .get(BusinessTripExpensesTransactionsMatchProvider)
    .insertBusinessTripExpenseMatch({
      businessTripExpenseId,
      transactionId,
      amount,
    });
  const insertToCategoryPromise = async () => {
    switch (category) {
      case 'FLIGHT':
        return injector.get(BusinessTripFlightsExpensesProvider).insertBusinessTripFlightsExpense({
          id: businessTripExpenseId,
        });
      case 'ACCOMMODATION':
        return injector
          .get(BusinessTripAccommodationsExpensesProvider)
          .insertBusinessTripAccommodationsExpense({
            id: businessTripExpenseId,
          });
      case 'TRAVEL_AND_SUBSISTENCE':
        return injector
          .get(BusinessTripTravelAndSubsistenceExpensesProvider)
          .insertBusinessTripTravelAndSubsistenceExpense({ id: businessTripExpenseId });
      case 'OTHER':
        return injector.get(BusinessTripOtherExpensesProvider).insertBusinessTripOtherExpense({
          id: businessTripExpenseId,
        });
      case 'CAR_RENTAL':
        return injector
          .get(BusinessTripCarRentalExpensesProvider)
          .insertBusinessTripCarRentalExpense({
            id: businessTripExpenseId,
            days: 0,
            isFuelExpense: false,
          });
      default:
        throw new GraphQLError(`Invalid category ${category}`);
    }
  };
  await Promise.all([updateTransactionMatchPromise, insertToCategoryPromise()]);
};

export async function createTravelAndSubsistenceExpense(
  context: GraphQLModules.Context,
  fields: AddBusinessTripTravelAndSubsistenceExpenseInput,
): Promise<string> {
  const { injector, adminContext } = context;
  const { businessTripTagId } = adminContext.businessTrips;
  try {
    const coreExpensePromise = injector
      .get(BusinessTripExpensesProvider)
      .insertBusinessTripExpense({
        businessTripId: fields.businessTripId,
        category: 'TRAVEL_AND_SUBSISTENCE',
      })
      .then(res => res[0]);

    const chargeGenerationPromise = generateChargeForEmployeePayment(
      context,
      fields.businessTripId,
      fields.expenseType ?? undefined,
    );

    const [coreExpense, chargeId] = await Promise.all([
      coreExpensePromise,
      chargeGenerationPromise,
    ]);

    const [charge] = await Promise.all([
      injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId),
      injector
        .get(BusinessTripTravelAndSubsistenceExpensesProvider)
        .insertBusinessTripTravelAndSubsistenceExpense({
          id: coreExpense.id,
          expenseType: fields.expenseType,
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
      businessTripTagId
        ? injector.get(ChargeTagsProvider).insertChargeTag({ chargeId, tagId: businessTripTagId })
        : Promise.resolve(),
    ]);

    if (!charge) {
      throw new GraphQLError('Failed to generate charge for employee payment');
    }

    // generate ledger records
    await generateLedgerRecordsForBusinessTrip(
      charge,
      { insertLedgerRecordsIfNotExists: true },
      context,
      {} as GraphQLResolveInfo,
    );

    return coreExpense.id;
  } catch (e) {
    console.error(`Error adding new business trip travel & subsistence expense`, e);
    throw new GraphQLError('Error adding new business trip travel & subsistence expense');
  }
}
