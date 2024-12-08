import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IAddBusinessTripAttendeesParams,
  IAddBusinessTripAttendeesQuery,
  IGetBusinessTripsAttendeesByBusinessTripIdsQuery,
  IGetBusinessTripsAttendeesByBusinessTripIdsResult,
  IGetBusinessTripsIDsByChargeIdsQuery,
  IRemoveBusinessTripAttendeesParams,
  IRemoveBusinessTripAttendeesQuery,
  IUpdateBusinessTripAttendeeParams,
  IUpdateBusinessTripAttendeeQuery,
} from '../types.js';

const getBusinessTripsIDsByChargeIds = sql<IGetBusinessTripsIDsByChargeIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trip_charges
  WHERE charge_id IN $$chargeIds;`;

const getBusinessTripsAttendeesByBusinessTripIds = sql<IGetBusinessTripsAttendeesByBusinessTripIdsQuery>`
  SELECT bta.business_trip_id, bta.arrival, bta.departure, b.*, fe.type, fe.owner_id, fe.name, fe.sort_code, fe.created_at, fe.updated_at
  FROM accounter_schema.financial_entities fe
  LEFT JOIN accounter_schema.business_trips_attendees bta
    ON bta.attendee_business_id = fe.id
  LEFT JOIN accounter_schema.businesses b
    ON bta.attendee_business_id = b.id
  WHERE ($isBusinessTripIds = 0 OR bta.business_trip_id IN $$businessTripIds);`;

const addBusinessTripAttendees = sql<IAddBusinessTripAttendeesQuery>`
  INSERT INTO accounter_schema.business_trips_attendees (business_trip_id, attendee_business_id, arrival, departure)
  VALUES ($businessTripId, $businessId, $arrival, $departure)
  ON CONFLICT DO NOTHING
  RETURNING *;`;

const updateBusinessTripAttendee = sql<IUpdateBusinessTripAttendeeQuery>`
  UPDATE accounter_schema.business_trips_attendees
  SET
  arrival = COALESCE(
    $arrival,
    arrival
  ),
  departure = COALESCE(
    $departure,
    departure
  )
  WHERE
    business_trip_id = $businessTripId
    AND attendee_business_id = $attendeeBusinessId
  RETURNING *;
`;

const removeBusinessTripAttendees = sql<IRemoveBusinessTripAttendeesQuery>`
  DELETE FROM accounter_schema.business_trips_attendees
  WHERE business_trip_id = $businessTripId
    AND attendee_business_id = $businessId
  RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripAttendeesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchBusinessTripsAttendeesByChargeIds(chargeIds: readonly string[]) {
    const businessTripsMatches = await getBusinessTripsIDsByChargeIds.run(
      {
        chargeIds,
      },
      this.dbProvider,
    );
    const businessTripsAttendees = await this.getBusinessTripsAttendeesByBusinessTripIdLoader
      .loadMany(
        businessTripsMatches
          .filter(record => record.business_trip_id)
          .map(record => record.business_trip_id!),
      )
      .then(
        records =>
          records
            .flat()
            .filter(
              record => !(record instanceof Error),
            ) as IGetBusinessTripsAttendeesByBusinessTripIdsResult[],
      );
    return chargeIds.map(id =>
      businessTripsMatches
        .filter(record => record.charge_id === id)
        .map(match =>
          businessTripsAttendees.filter(
            attendee => attendee.business_trip_id === match.business_trip_id,
          ),
        )
        .flat(),
    );
  }

  public getBusinessTripsAttendeesByChargeIdLoader = new DataLoader(
    (chargeIds: readonly string[]) => this.batchBusinessTripsAttendeesByChargeIds(chargeIds),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsAttendeesByBusinessTripIds(businessTripIds: readonly string[]) {
    const businessTrips = await getBusinessTripsAttendeesByBusinessTripIds.run(
      {
        isBusinessTripIds: businessTripIds.length > 0 ? 1 : 0,
        businessTripIds,
      },
      this.dbProvider,
    );
    return businessTripIds.map(id =>
      businessTrips.filter(record => record.business_trip_id === id),
    );
  }

  public getBusinessTripsAttendeesByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsAttendeesByBusinessTripIds(ids),
    {
      cacheKeyFn: key => `business-trip-${key}-attendees`,
      cacheMap: this.cache,
    },
  );

  public addBusinessTripAttendees(params: IAddBusinessTripAttendeesParams) {
    if (params.businessTripId) {
      this.cache.delete(`business-trip-${params.businessTripId}-attendees`);
    }
    return addBusinessTripAttendees.run(params, this.dbProvider);
  }

  public updateBusinessTripAttendee(params: IUpdateBusinessTripAttendeeParams) {
    if (params.businessTripId) {
      this.cache.delete(`business-trip-${params.businessTripId}-attendees`);
    }
    return updateBusinessTripAttendee.run(params, this.dbProvider);
  }

  public removeBusinessTripAttendees(params: IRemoveBusinessTripAttendeesParams) {
    if (params.businessTripId) {
      this.cache.delete(`business-trip-${params.businessTripId}-attendees`);
    }
    return removeBusinessTripAttendees.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
