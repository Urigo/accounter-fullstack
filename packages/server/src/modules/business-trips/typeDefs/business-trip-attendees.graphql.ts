import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    insertBusinessTripAttendee(fields: InsertBusinessTripAttendeeInput!): UUID!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateBusinessTripAttendee(fields: BusinessTripAttendeeUpdateInput!): UUID!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    deleteBusinessTripAttendee(fields: DeleteBusinessTripAttendeeInput!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
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
    flights: [BusinessTripFlightExpense!]!
    accommodations: [BusinessTripAccommodationExpense!]!
  }
`;
