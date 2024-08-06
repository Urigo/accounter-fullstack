import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import {
  IUpdateAccountantApprovalParams,
  IUpdateAccountantApprovalQuery,
} from '@modules/charges/types.js';
import { sql } from '@pgtyped/runtime';
import { IGetBusinessTripsByChargeIdsQuery } from '../__generated__/business-trips.types.js';
import type {
  BusinessTripProto,
  IDeleteChargeBusinessTripQuery,
  IGetAllBusinessTripsQuery,
  IGetBusinessTripsByIdsQuery,
  IInsertBusinessTripParams,
  IInsertBusinessTripQuery,
  IUpdateBusinessTripParams,
  IUpdateBusinessTripQuery,
  IUpdateChargeBusinessTripQuery,
} from '../types.js';

const getAllBusinessTrips = sql<IGetAllBusinessTripsQuery>`
  SELECT *
  FROM accounter_schema.extended_business_trips`;

const getBusinessTripsByIds = sql<IGetBusinessTripsByIdsQuery>`
  SELECT bt.*
  FROM accounter_schema.extended_business_trips bt
  WHERE ($isBusinessTripsIds = 0 OR bt.id IN $$businessTripsIds);`;

const getBusinessTripsByChargeIds = sql<IGetBusinessTripsByChargeIdsQuery>`
  SELECT btc.charge_id, bt.*
  FROM accounter_schema.business_trip_charges btc
  LEFT JOIN accounter_schema.extended_business_trips bt
    ON btc.business_trip_id = bt.id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

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
    $destination,
    destination
  ),
  trip_purpose = COALESCE(
    $tripPurpose,
    trip_purpose
  ),
  accountant_reviewed = COALESCE(
    $accountantReviewed,
    accountant_reviewed
  )
  WHERE
    id = $businessTripId
  RETURNING id;
`;

const insertBusinessTrip = sql<IInsertBusinessTripQuery>`
  INSERT INTO accounter_schema.business_trips (name, destination, trip_purpose)
  VALUES($name, $destination, $tripPurpose)
  RETURNING id;`;

const updateAccountantApproval = sql<IUpdateAccountantApprovalQuery>`
  UPDATE accounter_schema.business_trips
  SET
    accountant_reviewed = $accountantReviewed
  WHERE
    id = $businessTripId
  RETURNING *;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripsProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTrips() {
    return getAllBusinessTrips.run(undefined, this.dbProvider) as Promise<BusinessTripProto[]>;
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
    (ids: readonly string[]) =>
      this.batchBusinessTripsByIds(ids) as Promise<(BusinessTripProto | undefined)[]>,
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
    if (businessTripId) {
      return updateChargeBusinessTrip.run({ chargeId, businessTripId }, this.dbProvider);
    }
    return deleteChargeBusinessTrip.run({ chargeId }, this.dbProvider);
  }

  public updateBusinessTrip(params: IUpdateBusinessTripParams) {
    return updateBusinessTrip.run(params, this.dbProvider);
  }

  public insertBusinessTrip(params: IInsertBusinessTripParams) {
    return insertBusinessTrip.run(params, this.dbProvider);
  }

  public updateAccountantApproval(params: IUpdateAccountantApprovalParams) {
    return updateAccountantApproval.run(params, this.dbProvider);
  }
}
