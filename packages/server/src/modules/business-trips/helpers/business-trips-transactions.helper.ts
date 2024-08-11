import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { LedgerError } from '@modules/ledger/helpers/utils.helper.js';
import { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import { BUSINESS_TRIP_TAX_CATEGORY_ID, DEFAULT_FINANCIAL_ENTITY_ID } from '@shared/constants';
import { BusinessTripEmployeePaymentsProvider } from '../providers/business-trips-employee-payments.provider.js';
import { BusinessTripTransactionsProvider } from '../providers/business-trips-transactions.provider.js';
import { BusinessTripsProvider } from '../providers/business-trips.provider.js';
import type {
  business_trip_transaction_type,
  IGetBusinessTripsTransactionsByTransactionIdsResult,
  IUpdateBusinessTripEmployeePaymentParams,
  IUpdateBusinessTripTransactionParams,
} from '../types.js';

function validateTransactionAgainstBusinessTripsExpenses(
  transaction: IGetTransactionsByChargeIdsResult,
  transactionMatchingExpenses: IGetBusinessTripsTransactionsByTransactionIdsResult[],
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
        `Transaction reference "${transaction.source_reference}" amount does not match the business expenses total amount`,
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
    .get(BusinessTripTransactionsProvider)
    .getBusinessTripsTransactionsByTransactionIdLoader.load(transaction.id);

  return validateTransactionAgainstBusinessTripsExpenses(transaction, transactionMatchingExpenses);
};

export const getTransactionMatchedAmount = async (
  injector: Injector,
  transaction: IGetTransactionsByChargeIdsResult,
): Promise<{ isFullyMatched: boolean; amount: number }> => {
  const transactionMatchingExpenses = await injector
    .get(BusinessTripTransactionsProvider)
    .getBusinessTripsTransactionsByTransactionIdLoader.load(transaction.id);

  if (!transactionMatchingExpenses?.length) {
    return {
      isFullyMatched: false,
      amount: 0,
    };
  }

  validateTransactionAgainstBusinessTripsExpenses(transaction, transactionMatchingExpenses);

  if (transactionMatchingExpenses[0].amount === null) {
    return {
      isFullyMatched: true,
      amount: Number(transaction.amount),
    };
  }
  const sum = transactionMatchingExpenses.reduce(
    (acc, expense) => (expense.amount ? acc + Number(expense.amount) : acc),
    0,
  );
  const isFullyMatched = Math.abs(Number(transaction.amount) - sum) < 0.005;
  return {
    isFullyMatched,
    amount: Number(transaction.amount),
  };
};

export async function coreTransactionUpdate(
  injector: Injector,
  fields: IUpdateBusinessTripTransactionParams &
    IUpdateBusinessTripEmployeePaymentParams & { id: string },
  categoryToValidate?: business_trip_transaction_type,
) {
  const { id, businessTripId, date, valueDate, amount, currency, employeeBusinessId, chargeId } =
    fields;
  const [currentTransaction] = await injector
    .get(BusinessTripTransactionsProvider)
    .getBusinessTripsTransactionsByIdLoader.load(id);

  if (!currentTransaction) {
    throw new GraphQLError(`Business trip transaction with id ${id} not found`);
  }
  if (categoryToValidate && currentTransaction.category !== categoryToValidate) {
    throw new GraphQLError(
      `Business trip transaction with id ${id} is not a ${categoryToValidate} transaction`,
    );
  }

  const updateCoreTransactionPromise = async () => {
    return businessTripId
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
  };

  const updateEmployeePaymentPromise = async () => {
    const hasCommonFieldsToUpdate =
      date || valueDate || amount || currency || employeeBusinessId || chargeId;
    return hasCommonFieldsToUpdate
      ? injector.get(BusinessTripEmployeePaymentsProvider).updateBusinessTripEmployeePayment({
          businessTripTransactionId: id,
          chargeId,
          date,
          valueDate,
          currency,
          employeeBusinessId,
        })
      : Promise.resolve();
  };

  const [updatedTripTransaction] = await Promise.all([
    updateCoreTransactionPromise(),
    updateEmployeePaymentPromise(),
  ]);

  return updatedTripTransaction;
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
