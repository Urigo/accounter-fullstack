import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Mutation {
    insertBusinessTripAttendee(fields: InsertBusinessTripAttendeeInput!): UUID! @auth(role: ADMIN)
    updateBusinessTripAttendee(fields: BusinessTripAttendeeUpdateInput!): UUID! @auth(role: ADMIN)
    deleteBusinessTripAttendee(fields: DeleteBusinessTripAttendeeInput!): Boolean!
      @auth(role: ADMIN)
  }

  " the input for adding an attendee to a business trip "
  input InsertBusinessTripAttendeeInput {
    businessTripId: UUID!
    attendeeId: UUID!
    arrivalDate: TimelessDate
    departureDate: TimelessDate
  }

  " the input for updating a business trip attendee "
  input BusinessTripAttendeeUpdateInput {
    businessTripId: UUID!
    attendeeId: UUID!
    arrivalDate: TimelessDate
    departureDate: TimelessDate
  }

  " the input for removing a business trip attendee "
  input DeleteBusinessTripAttendeeInput {
    businessTripId: UUID!
    attendeeId: UUID!
  }

  " represent business trip attendee "
  type BusinessTripAttendee {
    id: UUID!
    name: String!
    business: Business
    arrivalDate: TimelessDate
    departureDate: TimelessDate
  }
`;
