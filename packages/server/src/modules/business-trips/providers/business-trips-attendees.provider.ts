import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IAddBusinessTripAttendeesParams,
  IAddBusinessTripAttendeesQuery,
  IGetAllBusinessTripsAttendeesQuery,
  IGetBusinessTripsAttendeesByBusinessTripIdsQuery,
  IGetBusinessTripsAttendeesByChargeIdsQuery,
  IRemoveBusinessTripAttendeesParams,
  IRemoveBusinessTripAttendeesQuery,
  IUpdateBusinessTripAttendeeParams,
  IUpdateBusinessTripAttendeeQuery,
} from '../types.js';

const getAllBusinessTripsAttendees = sql<IGetAllBusinessTripsAttendeesQuery>`
  SELECT *
  FROM accounter_schema.business_trips_attendees`;

const getBusinessTripsAttendeesByChargeIds = sql<IGetBusinessTripsAttendeesByChargeIdsQuery>`
  SELECT btc.charge_id, fe.*
  FROM accounter_schema.financial_entities fe
  LEFT JOIN accounter_schema.business_trips_attendees bta
    ON bta.attendee_business_id = fe.id
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON bta.business_trip_id = btc.business_trip_id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

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
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTripsAttendees() {
    return getAllBusinessTripsAttendees.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsAttendeesByChargeIds(chargeIds: readonly string[]) {
    const businessTrips = await getBusinessTripsAttendeesByChargeIds.run(
      {
        isChargeIds: chargeIds.length > 0 ? 1 : 0,
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id => businessTrips.filter(record => record.charge_id === id));
  }

  public getBusinessTripsAttendeesByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsAttendeesByChargeIds(ids),
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
      cache: false,
    },
  );

  public addBusinessTripAttendees(params: IAddBusinessTripAttendeesParams) {
    return addBusinessTripAttendees.run(params, this.dbProvider);
  }

  public updateBusinessTripAttendee(params: IUpdateBusinessTripAttendeeParams) {
    return updateBusinessTripAttendee.run(params, this.dbProvider);
  }

  public removeBusinessTripAttendees(params: IRemoveBusinessTripAttendeesParams) {
    return removeBusinessTripAttendees.run(params, this.dbProvider);
  }
}
