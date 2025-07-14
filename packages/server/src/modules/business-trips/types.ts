import type { IGetAllBusinessTripsResult } from './__generated__/business-trips.types.js';

export * from './__generated__/types.js';
export type { DateOrString, accountant_status } from './__generated__/business-trips.types.js';
export * from './__generated__/business-trips.types.js';
export type { Json } from './__generated__/business-trips-attendees.types.js';
export * from './__generated__/business-trips-attendees.types.js';
export * from './__generated__/business-trips-tax-variables.types.js';
export type {
  business_trip_transaction_type,
  currency,
  stringArray,
} from './__generated__/business-trips-expenses.types.js';
export * from './__generated__/business-trips-expenses.types.js';
export type { NumberOrString } from './__generated__/business-trips-expenses-transactions-match.types.js';
export * from './__generated__/business-trips-expenses-transactions-match.types.js';
export * from './__generated__/business-trips-expenses-flights.types.js';
export * from './__generated__/business-trips-expenses-accommodations.types.js';
export * from './__generated__/business-trips-expenses-travel-and-subsistence.types.js';
export * from './__generated__/business-trips-expenses-other.types.js';
export * from './__generated__/business-trips-employee-payments.types.js';
export * from './__generated__/business-trips-expenses-car-rental.types.js';
export type BusinessTripProto = Omit<IGetAllBusinessTripsResult, 'id' | 'name'> & {
  id: NonNullable<IGetAllBusinessTripsResult['id']>;
  name: NonNullable<IGetAllBusinessTripsResult['name']>;
};
