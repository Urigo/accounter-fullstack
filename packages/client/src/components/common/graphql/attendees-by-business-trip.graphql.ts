// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AttendeesByBusinessTrip($businessTripId: UUID!) {
    businessTrip(id: $businessTripId) {
      id
      attendees {
        id
        name
      }
    }
  }
`;

export {};
