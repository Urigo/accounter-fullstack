import { graphql } from '../../../graphql.js';

export const AllBusinessTripAttendeesDocument = graphql(`
  query AllBusinessTripAttendees($businessTripId: UUID!) {
    businessTrip(id: $businessTripId) {
      id
      attendees {
        id
        name
      }
    }
  }
`);
