import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IDeleteBusinessTripEmployeePaymentParams,
  IDeleteBusinessTripEmployeePaymentQuery,
  IInsertBusinessTripEmployeePaymentParams,
  IInsertBusinessTripEmployeePaymentQuery,
  IReplaceBusinessTripsEmployeePaymentsChargeIdParams,
  IReplaceBusinessTripsEmployeePaymentsChargeIdQuery,
  IUpdateBusinessTripEmployeePaymentParams,
  IUpdateBusinessTripEmployeePaymentQuery,
} from '../types.js';

const updateBusinessTripEmployeePayment = sql<IUpdateBusinessTripEmployeePaymentQuery>`
  UPDATE accounter_schema.business_trips_employee_payments
  SET
  charge_id = COALESCE(
    $chargeId,
    charge_id
  ),
  date = COALESCE(
    $date,
    date
  ),
  value_date = COALESCE(
    $valueDate,
    value_date
  ),
  amount = COALESCE(
    $amount,
    amount
  ),
  currency = COALESCE(
    $currency,
    currency
  ),
  employee_business_id = COALESCE(
    $employeeBusinessId,
    employee_business_id
  )
  WHERE
    id = $businessTripTransactionId
  RETURNING *;
`;

const insertBusinessTripEmployeePayment = sql<IInsertBusinessTripEmployeePaymentQuery>`
  INSERT INTO accounter_schema.business_trips_employee_payments (id, charge_id, date, value_date, amount, currency, employee_business_id)
  VALUES($businessTripTransactionId, $chargeId, $date, $valueDate, $amount, $currency, $employeeBusinessId)
  RETURNING *;`;

const deleteBusinessTripEmployeePayment = sql<IDeleteBusinessTripEmployeePaymentQuery>`
  DELETE FROM accounter_schema.business_trips_employee_payments
  WHERE id = $businessTripTransactionId
  RETURNING id;
`;

const replaceBusinessTripsEmployeePaymentsChargeId = sql<IReplaceBusinessTripsEmployeePaymentsChargeIdQuery>`
  UPDATE accounter_schema.business_trips_employee_payments
  SET charge_id = $assertChargeID
  WHERE charge_id = $replaceChargeID
  RETURNING *;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripEmployeePaymentsProvider {
  constructor(private dbProvider: DBProvider) {}

  public updateBusinessTripEmployeePayment(params: IUpdateBusinessTripEmployeePaymentParams) {
    return updateBusinessTripEmployeePayment.run(params, this.dbProvider);
  }

  public replaceBusinessTripsEmployeePaymentsChargeId(
    params: IReplaceBusinessTripsEmployeePaymentsChargeIdParams,
  ) {
    return replaceBusinessTripsEmployeePaymentsChargeId.run(params, this.dbProvider);
  }

  public insertBusinessTripEmployeePayment(params: IInsertBusinessTripEmployeePaymentParams) {
    return insertBusinessTripEmployeePayment.run(params, this.dbProvider);
  }

  public deleteBusinessTripEmployeePayment(params: IDeleteBusinessTripEmployeePaymentParams) {
    return deleteBusinessTripEmployeePayment.run(params, this.dbProvider);
  }
}
