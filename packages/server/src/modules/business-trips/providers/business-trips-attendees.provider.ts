import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  DateOrString,
  IAddBusinessTripAttendeesParams,
  IAddBusinessTripAttendeesQuery,
  IGetBusinessTripsAttendeesByBusinessTripIdsQuery,
  IGetBusinessTripsAttendeesByBusinessTripIdsResult,
  IGetBusinessTripsByChargeIdsResult,
  IGetLastFlightByDateAndAttendeeIdQuery,
  IRemoveBusinessTripAttendeesParams,
  IRemoveBusinessTripAttendeesQuery,
  IUpdateBusinessTripAttendeeParams,
  IUpdateBusinessTripAttendeeQuery,
} from '../types.js';
import { BusinessTripsProvider } from './business-trips.provider.js';

const getBusinessTripsAttendeesByBusinessTripIds = sql<IGetBusinessTripsAttendeesByBusinessTripIdsQuery>`
  SELECT bta.business_trip_id, bta.arrival, bta.departure, b.*, fe.type, fe.owner_id, fe.name, fe.sort_code, fe.created_at, fe.updated_at
  FROM accounter_schema.financial_entities fe
  LEFT JOIN accounter_schema.business_trips_attendees bta
    ON bta.attendee_business_id = fe.id
  LEFT JOIN accounter_schema.businesses b
    ON bta.attendee_business_id = b.id
  WHERE bta.business_trip_id IN $$businessTripIds;`;

const getLastFlightByDateAndAttendeeId = sql<IGetLastFlightByDateAndAttendeeIdQuery>`
  SELECT *
  FROM accounter_schema.business_trips_attendees
  WHERE attendee_business_id = $attendeeBusinessId
    AND arrival < $date
    AND departure <= $date AND departure >= $date - INTERVAL '14 DAY'
  ORDER BY departure DESC
      FETCH FIRST 1 ROWS ONLY;`;

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

  constructor(
    private dbProvider: DBProvider,
    private businessTripsProvider: BusinessTripsProvider,
  ) {}

  private async batchBusinessTripsAttendeesByChargeIds(chargeIds: readonly string[]) {
    const businessTripsMatches = await this.businessTripsProvider.getBusinessTripsByChargeIdLoader
      .loadMany(chargeIds)
      .then(
        res =>
          res.filter(
            item => item && !(item instanceof Error),
          ) as IGetBusinessTripsByChargeIdsResult[],
      );
    const businessTripsAttendees = await this.getBusinessTripsAttendeesByBusinessTripIdLoader
      .loadMany(businessTripsMatches.filter(record => record.id).map(record => record.id))
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
          businessTripsAttendees.filter(attendee => attendee.business_trip_id === match.id),
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

  public getLastFlightByDateAndAttendeeId(params: {
    attendeeBusinessId: string;
    date: DateOrString;
  }) {
    return getLastFlightByDateAndAttendeeId.run(params, this.dbProvider);
  }

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
