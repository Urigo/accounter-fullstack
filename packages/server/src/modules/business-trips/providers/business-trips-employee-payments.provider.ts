import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IDeleteBusinessTripEmployeePaymentParams,
  IDeleteBusinessTripEmployeePaymentQuery,
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
WHERE ($isChargeIds = 0 OR btep.charge_id IN $$chargeIds);`;

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

  private async batchBusinessTripEmployeePaymentsByChargeIds(chargeIds: readonly string[]) {
    const businessTrips = await getBusinessTripEmployeePaymentsByChargeIds.run(
      {
        isChargeIds: chargeIds.length > 0 ? 1 : 0,
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id => businessTrips.filter(record => record.charge_id === id));
  }

  public getBusinessTripEmployeePaymentsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripEmployeePaymentsByChargeIds(ids),
    {
      cache: false,
    },
  );

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
