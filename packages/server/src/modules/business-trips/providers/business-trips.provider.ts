import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import { IGetBusinessTripsByChargeIdsQuery } from '../__generated__/business-trips.types.js';
import type {
  BusinessTripProto,
  IDeleteChargeBusinessTripQuery,
  IGetAllBusinessTripsQuery,
  IGetBusinessTripsByDatesParams,
  IGetBusinessTripsByDatesQuery,
  IGetBusinessTripsByIdsQuery,
  IGetChargeIdsByBusinessTripIdQuery,
  IInsertBusinessTripParams,
  IInsertBusinessTripQuery,
  IUpdateAccountantApprovalParams,
  IUpdateAccountantApprovalQuery,
  IUpdateBusinessTripParams,
  IUpdateBusinessTripQuery,
  IUpdateChargeBusinessTripQuery,
} from '../types.js';

const getAllBusinessTrips = sql<IGetAllBusinessTripsQuery>`
  SELECT *
  FROM accounter_schema.business_trips`;

const getBusinessTripsByIds = sql<IGetBusinessTripsByIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips
  WHERE  id IN $$businessTripsIds;`;

const getBusinessTripsByChargeIds = sql<IGetBusinessTripsByChargeIdsQuery>`
  SELECT btc.charge_id, bt.*
  FROM accounter_schema.business_trip_charges btc
  LEFT JOIN accounter_schema.business_trips bt
    ON btc.business_trip_id = bt.id
  WHERE btc.charge_id IN $$chargeIds;`;

const getChargeIdsByBusinessTripId = sql<IGetChargeIdsByBusinessTripIdQuery>`
  SELECT charge_id, business_trip_id
  FROM accounter_schema.business_trip_charges
  WHERE business_trip_id IN $$businessTripsIds;`;

const getBusinessTripsByDates = sql<IGetBusinessTripsByDatesQuery>`
  WITH business_trips_dates AS (SELECT business_trips_attendees.business_trip_id AS id,
      min(business_trips_attendees.arrival)     AS from_date,
      max(business_trips_attendees.departure)   AS to_date
    FROM accounter_schema.business_trips_attendees
    GROUP BY business_trips_attendees.business_trip_id)
  SELECT DISTINCT ON (bt.id) bt.*,
    btc.charge_id,
    business_trips_dates.from_date,
    business_trips_dates.to_date
  FROM accounter_schema.business_trips bt
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON bt.id = btc.business_trip_id
  LEFT JOIN business_trips_dates
    ON business_trips_dates.id = bt.id
  WHERE business_trips_dates.from_date >= $fromDate AND business_trips_dates.to_date < $toDate ;`;

const updateChargeBusinessTrip = sql<IUpdateChargeBusinessTripQuery>`
  INSERT INTO accounter_schema.business_trip_charges (charge_id, business_trip_id)
  VALUES($chargeId, $businessTripId)
  ON CONFLICT (charge_id) 
  DO 
    UPDATE SET business_trip_id = $businessTripId
  RETURNING *;`;

const deleteChargeBusinessTrip = sql<IDeleteChargeBusinessTripQuery>`
  DELETE FROM accounter_schema.business_trip_charges
  WHERE charge_id = $chargeId;`;

const updateBusinessTrip = sql<IUpdateBusinessTripQuery>`
  UPDATE accounter_schema.business_trips
  SET
  name = COALESCE(
    $name,
    name
  ),
  destination = COALESCE(
    $destinationCode,
    destination
  ),
  trip_purpose = COALESCE(
    $tripPurpose,
    trip_purpose
  ),
  accountant_status = COALESCE(
    $accountantStatus,
    accountant_status
  )
  WHERE
    id = $businessTripId
  RETURNING id;
`;

const insertBusinessTrip = sql<IInsertBusinessTripQuery>`
  INSERT INTO accounter_schema.business_trips (name, destination, trip_purpose)
  VALUES($name, $destinationCode, $tripPurpose)
  RETURNING id;`;

const updateAccountantApproval = sql<IUpdateAccountantApprovalQuery>`
  UPDATE accounter_schema.business_trips
  SET
    accountant_status = $accountantStatus
  WHERE
    id = $businessTripId
  RETURNING *;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTrips() {
    return getAllBusinessTrips.run(undefined, this.dbProvider) as Promise<BusinessTripProto[]>;
  }

  private async batchBusinessTripsByIds(businessTripsIds: readonly string[]) {
    const businessTrips = await getBusinessTripsByIds.run(
      {
        businessTripsIds,
      },
      this.dbProvider,
    );
    return businessTripsIds.map(id => businessTrips.find(record => record.id === id));
  }

  public getBusinessTripsByIdLoader = new DataLoader(
    (ids: readonly string[]) =>
      this.batchBusinessTripsByIds(ids) as Promise<(BusinessTripProto | undefined)[]>,
    {
      cacheKeyFn: key => `business-trip-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchBusinessTripByChargeIds(chargeIds: readonly string[]) {
    const businessTrips = await getBusinessTripsByChargeIds.run(
      {
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id => businessTrips.find(record => record.charge_id === id));
  }

  public getBusinessTripsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripByChargeIds(ids),
    {
      cacheKeyFn: key => `business-trips-charge-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchChargeIdsByBusinessTripIds(businessTripsIds: readonly string[]) {
    const businessTripsChargeIds = await getChargeIdsByBusinessTripId.run(
      {
        businessTripsIds,
      },
      this.dbProvider,
    );
    return businessTripsIds.map(tripId =>
      businessTripsChargeIds
        .filter(({ business_trip_id }) => business_trip_id === tripId)
        .map(match => match.charge_id),
    );
  }

  public getChargeIdsByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchChargeIdsByBusinessTripIds(ids),
    {
      cacheKeyFn: key => `business-trips-${key}-charges`,
      cacheMap: this.cache,
    },
  );

  public getBusinessTripsByDates(params: IGetBusinessTripsByDatesParams) {
    return getBusinessTripsByDates.run(params, this.dbProvider);
  }

  public async updateChargeBusinessTrip(chargeId: string, businessTripId: string | null) {
    const trip = await this.getBusinessTripsByChargeIdLoader.load(chargeId);
    if (trip) {
      this.cache.delete(`business-trip-${trip.id}`);
      this.cache.delete(`business-trips-${trip.id}-charges`);
    }
    this.cache.delete(`business-trips-charge-${chargeId}`);
    if (businessTripId) {
      this.cache.delete(`business-trip-${businessTripId}`);
      this.cache.delete(`business-trips-${businessTripId}-charges`);
      return updateChargeBusinessTrip.run({ chargeId, businessTripId }, this.dbProvider);
    }
    return deleteChargeBusinessTrip.run({ chargeId }, this.dbProvider);
  }

  public async updateBusinessTrip(params: IUpdateBusinessTripParams) {
    if (params.businessTripId) {
      const chargeIds = await this.getChargeIdsByBusinessTripIdLoader.load(params.businessTripId);
      if (chargeIds) {
        chargeIds.map(chargeId => this.cache.delete(`business-trips-charge-${chargeId}`));
      }
      this.cache.delete(`business-trip-${params.businessTripId}`);
    }
    return updateBusinessTrip.run(params, this.dbProvider);
  }

  public insertBusinessTrip(params: IInsertBusinessTripParams) {
    return insertBusinessTrip.run(params, this.dbProvider);
  }

  public async updateAccountantApproval(params: IUpdateAccountantApprovalParams) {
    if (params.businessTripId) {
      const chargeIds = await this.getChargeIdsByBusinessTripIdLoader.load(params.businessTripId);
      if (chargeIds) {
        chargeIds.map(chargeId => this.cache.delete(`business-trips-charge-${chargeId}`));
      }
      this.cache.delete(`business-trip-${params.businessTripId}`);
    }
    return updateAccountantApproval.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
