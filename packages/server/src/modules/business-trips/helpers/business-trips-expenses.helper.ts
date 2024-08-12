import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { LedgerError } from '@modules/ledger/helpers/utils.helper.js';
import { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import { BUSINESS_TRIP_TAX_CATEGORY_ID, DEFAULT_FINANCIAL_ENTITY_ID } from '@shared/constants';
import { BusinessTripExpenseCategories } from '@shared/gql-types';
import { BusinessTripEmployeePaymentsProvider } from '../providers/business-trips-employee-payments.provider.js';
import { BusinessTripAccommodationsExpensesProvider } from '../providers/business-trips-expenses-accommodations.provider.js';
import { BusinessTripFlightsExpensesProvider } from '../providers/business-trips-expenses-flights.provider.js';
import { BusinessTripOtherExpensesProvider } from '../providers/business-trips-expenses-other.provider.js';
import { BusinessTripTravelAndSubsistenceExpensesProvider } from '../providers/business-trips-expenses-travel-and-subsistence.provider.js';
import { BusinessTripExpensesProvider } from '../providers/business-trips-expenses.provider.js';
import { BusinessTripsProvider } from '../providers/business-trips.provider.js';
import type {
  business_trip_transaction_type,
  IGetBusinessTripsExpensesByTransactionIdsResult,
  IUpdateBusinessTripEmployeePaymentParams,
  IUpdateBusinessTripExpenseParams,
} from '../types.js';

function validateTransactionAgainstBusinessTripsExpenses(
  transaction: IGetTransactionsByChargeIdsResult,
  transactionMatchingExpenses: IGetBusinessTripsExpensesByTransactionIdsResult[],
): boolean {
  if (!transactionMatchingExpenses?.length) {
    throw new LedgerError(
      `Transaction reference "${transaction.source_reference}" is not part of a business trip`,
    );
  }
  let hasManualSetAmounts = false;
  let hasAutomatedSetAmounts = false;
  transactionMatchingExpenses.map(expense => {
    if (expense.amount) {
      hasManualSetAmounts = true;
    } else {
      hasAutomatedSetAmounts = true;
    }
  });
  if (hasManualSetAmounts && hasAutomatedSetAmounts) {
    throw new LedgerError(
      `Business expenses for transaction reference "${transaction.source_reference}" has both manual and automated set amounts. Please align the amounts`,
    );
  }
  if (hasManualSetAmounts) {
    const totalAmount = transactionMatchingExpenses.reduce(
      (acc, expense) => acc + Number(expense.amount),
      0,
    );

    if (Math.abs(Number(transaction.amount) - totalAmount) > 0.005) {
      throw new LedgerError(
        `Transaction reference "${transaction.source_reference}" amount does not match the business trip expenses total amount`,
      );
    }
  }
  return true;
}

export const validateTransactionAgainstBusinessTrips = async (
  injector: Injector,
  transaction: IGetTransactionsByChargeIdsResult,
): Promise<boolean> => {
  const transactionMatchingExpenses = await injector
    .get(BusinessTripExpensesProvider)
    .getBusinessTripsExpensesByTransactionIdLoader.load(transaction.id);

  return validateTransactionAgainstBusinessTripsExpenses(transaction, transactionMatchingExpenses);
};

export const getTransactionMatchedAmount = async (
  injector: Injector,
  transaction: IGetTransactionsByChargeIdsResult,
): Promise<{ isFullyMatched: boolean; amount: number; errors?: string[] }> => {
  const transactionMatchingExpenses = await injector
    .get(BusinessTripExpensesProvider)
    .getBusinessTripsExpensesByTransactionIdLoader.load(transaction.id);

  if (!transactionMatchingExpenses?.length) {
    return {
      isFullyMatched: false,
      amount: 0,
    };
  }
  const expensesSum = transactionMatchingExpenses.reduce(
    (acc, expense) => (expense.amount ? acc + Number(expense.amount) : acc),
    0,
  );

  try {
    validateTransactionAgainstBusinessTripsExpenses(transaction, transactionMatchingExpenses);
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

  if (transactionMatchingExpenses[0].amount === null) {
    return {
      isFullyMatched: true,
      amount: Number(transaction.amount),
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

export async function generateChargeForEmployeePayment(injector: Injector, businessTripId: string) {
  try {
    const [{ id: chargeId }] = await injector.get(ChargesProvider).generateCharge({
      ownerId: DEFAULT_FINANCIAL_ENTITY_ID,
      taxCategoryId: BUSINESS_TRIP_TAX_CATEGORY_ID,
      userDescription: 'Employee payment charge',
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
    .get(BusinessTripExpensesProvider)
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
      default:
        throw new GraphQLError(`Invalid category ${category}`);
    }
  };
  await Promise.all([updateTransactionMatchPromise, insertToCategoryPromise()]);
};
