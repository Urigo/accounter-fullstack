import type { LoaderFunctionArgs, Params } from 'react-router-dom';

/**
 * Type-safe route parameter definitions
 */

export interface ChargeParams extends Params {
  chargeId: string;
}

export interface BusinessParams extends Params {
  businessId: string;
}

export interface BusinessTripParams extends Params {
  businessTripId: string;
}

export interface ReportYearParams extends Params {
  year?: string;
}

/**
 * Type-safe loader argument types
 */
export type ChargeLoaderArgs = LoaderFunctionArgs<ChargeParams>;
export type BusinessLoaderArgs = LoaderFunctionArgs<BusinessParams>;
export type BusinessTripLoaderArgs = LoaderFunctionArgs<BusinessTripParams>;
export type ReportYearLoaderArgs = LoaderFunctionArgs<ReportYearParams>;

/**
 * Helper functions to validate and parse params
 */
export function validateChargeParams(params: Params): ChargeParams {
  if (!params.chargeId) {
    throw new Response('Charge ID is required', { status: 400 });
  }
  return { chargeId: params.chargeId };
}

export function validateBusinessParams(params: Params): BusinessParams {
  if (!params.businessId) {
    throw new Response('Business ID is required', { status: 400 });
  }
  return { businessId: params.businessId };
}

export function validateBusinessTripParams(params: Params): BusinessTripParams {
  if (!params.businessTripId) {
    throw new Response('Business Trip ID is required', { status: 400 });
  }
  return { businessTripId: params.businessTripId };
}

export function parseYearParam(params: Params): number | undefined {
  if (!params.year) return undefined;
  const year = parseInt(params.year, 10);
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    throw new Response('Invalid year parameter', { status: 400 });
  }
  return year;
}
