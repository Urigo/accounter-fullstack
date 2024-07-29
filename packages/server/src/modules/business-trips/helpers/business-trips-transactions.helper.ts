import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { BUSINESS_TRIP_TAX_CATEGORY_ID, DEFAULT_FINANCIAL_ENTITY_ID } from '@shared/constants';
import { BusinessTripEmployeePaymentsProvider } from '../providers/business-trips-employee-payments.provider.js';
import { BusinessTripTransactionsProvider } from '../providers/business-trips-transactions.provider.js';
import { BusinessTripsProvider } from '../providers/business-trips.provider.js';
import type {
  business_trip_transaction_type,
  IUpdateBusinessTripEmployeePaymentParams,
  IUpdateBusinessTripTransactionParams,
} from '../types.js';

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
