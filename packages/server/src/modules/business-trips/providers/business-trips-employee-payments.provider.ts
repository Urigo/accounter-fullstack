import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
import type {
  IDeleteBusinessTripEmployeePaymentParams,
  IDeleteBusinessTripEmployeePaymentQuery,
  IGetBusinessTripEmployeePaymentByIdQuery,
  IGetBusinessTripEmployeePaymentsByChargeIdsQuery,
  IInsertBusinessTripEmployeePaymentParams,
  IInsertBusinessTripEmployeePaymentQuery,
  IReplaceBusinessTripsEmployeePaymentsChargeIdParams,
  IReplaceBusinessTripsEmployeePaymentsChargeIdQuery,
  IUpdateBusinessTripEmployeePaymentParams,
  IUpdateBusinessTripEmployeePaymentQuery,
} from '../types.js';

const getBusinessTripEmployeePaymentsByChargeIds = sql<IGetBusinessTripEmployeePaymentsByChargeIdsQuery>`
  SELECT btep.*, btt.business_trip_id, btt.category
  FROM accounter_schema.business_trips_employee_payments btep
  LEFT JOIN accounter_schema.business_trips_transactions btt
    ON btt.id = btep.id
  WHERE btep.charge_id IN $$chargeIds;`;

const getBusinessTripEmployeePaymentById = sql<IGetBusinessTripEmployeePaymentByIdQuery>`
  SELECT *
  FROM accounter_schema.business_trips_employee_payments
  WHERE id = $businessTripExpenseId;`;

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
    id = $businessTripExpenseId
  RETURNING *;
`;

const insertBusinessTripEmployeePayment = sql<IInsertBusinessTripEmployeePaymentQuery>`
  INSERT INTO accounter_schema.business_trips_employee_payments (id, charge_id, date, value_date, amount, currency, employee_business_id)
  VALUES($businessTripExpenseId, $chargeId, $date, $valueDate, $amount, $currency, $employeeBusinessId)
  RETURNING *;`;

const deleteBusinessTripEmployeePayment = sql<IDeleteBusinessTripEmployeePaymentQuery>`
  DELETE FROM accounter_schema.business_trips_employee_payments
  WHERE id = $businessTripExpenseId
  RETURNING id;
`;

const replaceBusinessTripsEmployeePaymentsChargeId = sql<IReplaceBusinessTripsEmployeePaymentsChargeIdQuery>`
  UPDATE accounter_schema.business_trips_employee_payments
  SET charge_id = $assertChargeID
  WHERE charge_id = $replaceChargeID
  RETURNING *;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BusinessTripEmployeePaymentsProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchBusinessTripEmployeePaymentsByChargeIds(chargeIds: readonly string[]) {
    const businessTrips = await getBusinessTripEmployeePaymentsByChargeIds.run(
      {
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id => businessTrips.filter(record => record.charge_id === id));
  }

  public getBusinessTripEmployeePaymentsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripEmployeePaymentsByChargeIds(ids),
  );

  public async updateBusinessTripEmployeePayment(params: IUpdateBusinessTripEmployeePaymentParams) {
    // clear cache for old chargeId
    const [payment] = await getBusinessTripEmployeePaymentById.run(params, this.dbProvider);
    if (!payment) {
      throw new Error('Business trip employee payment not found');
    }
    this.getBusinessTripEmployeePaymentsByChargeIdLoader.clear(payment.charge_id);
    // clear cache for new chargeId
    if (params.chargeId) {
      this.getBusinessTripEmployeePaymentsByChargeIdLoader.clear(params.chargeId);
    }

    return updateBusinessTripEmployeePayment.run(params, this.dbProvider);
  }

  public replaceBusinessTripsEmployeePaymentsChargeId(
    params: IReplaceBusinessTripsEmployeePaymentsChargeIdParams,
  ) {
    if (params.assertChargeID) {
      this.getBusinessTripEmployeePaymentsByChargeIdLoader.clear(params.assertChargeID);
    }
    if (params.replaceChargeID) {
      this.getBusinessTripEmployeePaymentsByChargeIdLoader.clear(params.replaceChargeID);
    }
    return replaceBusinessTripsEmployeePaymentsChargeId.run(params, this.dbProvider);
  }

  public insertBusinessTripEmployeePayment(params: IInsertBusinessTripEmployeePaymentParams) {
    if (params.chargeId) {
      this.getBusinessTripEmployeePaymentsByChargeIdLoader.clear(params.chargeId);
    }
    return insertBusinessTripEmployeePayment.run(params, this.dbProvider);
  }

  public async deleteBusinessTripEmployeePayment(params: IDeleteBusinessTripEmployeePaymentParams) {
    // clear cache for old chargeId
    const [payment] = await getBusinessTripEmployeePaymentById.run(params, this.dbProvider);
    if (!payment) {
      throw new Error('Business trip employee payment not found');
    }
    this.getBusinessTripEmployeePaymentsByChargeIdLoader.clear(payment.charge_id);
    return deleteBusinessTripEmployeePayment.run(params, this.dbProvider);
  }

  public clearCache() {
    this.getBusinessTripEmployeePaymentsByChargeIdLoader.clearAll();
  }
}
