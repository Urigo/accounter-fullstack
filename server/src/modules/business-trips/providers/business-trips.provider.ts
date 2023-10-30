import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllBusinessTripsQuery,
  IGetBusinessTripsByIdsQuery,
  IInsertBusinessTripParams,
  IInsertBusinessTripQuery,
  IUpdateBusinessTripParams,
  IUpdateBusinessTripQuery,
  IUpdateChargeBusinessTripQuery,
} from '../types.js';
import { IGetBusinessTripsByChargeIdsQuery } from '../__generated__/business-trips.types.js';

const getAllBusinessTrips = sql<IGetAllBusinessTripsQuery>`
  SELECT *
  FROM accounter_schema.business_trips`;

const getBusinessTripsByIds = sql<IGetBusinessTripsByIdsQuery>`
  SELECT bt.*
  FROM accounter_schema.business_trips bt
  WHERE ($isBusinessTripsIds = 0 OR bt.id IN $$businessTripsIds);`;

const getBusinessTripsByChargeIds = sql<IGetBusinessTripsByChargeIdsQuery>`
  SELECT btc.charge_id, bt.*
  FROM accounter_schema.business_trip_charges btc
  LEFT JOIN accounter_schema.business_trips bt
    ON btc.business_trip_id = bt.id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

const updateChargeBusinessTrip = sql<IUpdateChargeBusinessTripQuery>`
  INSERT INTO accounter_schema.business_trip_charges (charge_id, business_trip_id)
  VALUES($chargeId, $businessTripId)
  ON CONFLICT (charge_id) 
  DO 
    UPDATE SET business_trip_id = $businessTripId
  RETURNING *;`;

const updateBusinessTrip = sql<IUpdateBusinessTripQuery>`
  UPDATE accounter_schema.business_trips
  SET
  name = COALESCE(
    $name,
    name
  ),
  from_date = COALESCE(
    $fromDate,
    from_date
  ),
  to_date = COALESCE(
    $toDate,
    to_date
  )
  WHERE
    id = $businessTripId
  RETURNING *;
`;

const insertBusinessTrip = sql<IInsertBusinessTripQuery>`
  INSERT INTO accounter_schema.business_trips (name, from_date, to_date)
  VALUES($name, $fromDate, $toDate)
  RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripsProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTrips() {
    return getAllBusinessTrips.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsByIds(businessTripsIds: readonly string[]) {
    const businessTrips = await getBusinessTripsByIds.run(
      {
        isBusinessTripsIds: businessTripsIds.length > 0 ? 1 : 0,
        businessTripsIds,
      },
      this.dbProvider,
    );
    return businessTripsIds.map(id => businessTrips.find(record => record.id === id));
  }

  public getBusinessTripsByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsByIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsByChargeIds(chargeIds: readonly string[]) {
    const businessTrips = await getBusinessTripsByChargeIds.run(
      {
        isChargeIds: chargeIds.length > 0 ? 1 : 0,
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id => businessTrips.find(record => record.charge_id === id));
  }

  public getBusinessTripsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsByChargeIds(ids),
    {
      cache: false,
    },
  );

  public async updateChargeBusinessTrip(chargeId: string, businessTripId: string | null) {
    return updateChargeBusinessTrip.run({chargeId, businessTripId}, this.dbProvider);
  }

  public updateBusinessTrip(params: IUpdateBusinessTripParams) {
    return updateBusinessTrip.run(params, this.dbProvider);
  }

  public insertBusinessTrip(params: IInsertBusinessTripParams) {
    return insertBusinessTrip.run(params, this.dbProvider);
  }
}
