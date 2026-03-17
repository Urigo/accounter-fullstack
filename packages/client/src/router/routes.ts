/**
 * Type-safe route definitions for the application
 *
 * Usage:
 * - navigate(ROUTES.CHARGES.DETAIL('charge-123'))
 * - <Link to={ROUTES.REPORTS.TAX(2024)}>Tax Report</Link>
 */

import type { ContoReportFiltersType } from '@/components/reports/conto/conto-report-filters.js';
import type { TrialBalanceReportFilters } from '@/components/reports/trial-balance-report/trial-balance-report-filters.js';
import type { ChargeFilter } from '@/gql/graphql.js';
import { CONTO_REPORT_FILTERS_KEY } from '@/helpers/consts.js';
import { isObjectEmpty } from '@/helpers/form.js';

export function encodeChargesFilters(filter?: ChargeFilter | null): string | null {
  return !filter || isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
}

export function getAllChargesParams(filter?: ChargeFilter | null, page?: number): string {
  const params = new URLSearchParams();
  if (page) {
    params.append('page', String(page));
  }

  const chargesFilters = encodeChargesFilters(filter);
  if (chargesFilters) {
    // Add it as a single encoded parameter
    params.append('chargesFilters', chargesFilters);
  }

  const queryParams = params.size > 0 ? `?${params}` : '/';
  return queryParams;
}

function encodeContoReportFilters(filter?: ContoReportFiltersType | null): string | null {
  if (!filter || isObjectEmpty(filter)) return null;
  return encodeURIComponent(JSON.stringify(filter));
}

function getContoReportParams(filter?: ContoReportFiltersType | null): string {
  const params = new URLSearchParams();

  const contoReportFilters = encodeContoReportFilters(filter);
  if (contoReportFilters) {
    // Add it as a single encoded parameter
    params.append(CONTO_REPORT_FILTERS_KEY, contoReportFilters);
  }

  const queryParams = params.size > 0 ? `?${params}` : '';
  return `/reports/conto${queryParams}`;
}

function encodeTrialBalanceReportFilters(filter?: TrialBalanceReportFilters | null): string | null {
  return !filter || isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
}

function getTrialBalanceReportHref(filter?: TrialBalanceReportFilters | null): string {
  const params = new URLSearchParams();

  const trialBalanceReportFilters = encodeTrialBalanceReportFilters(filter);
  if (trialBalanceReportFilters) {
    // Add it as a single encoded parameter
    params.append('trialBalanceReportFilters', trialBalanceReportFilters);
  }

  const queryParams = params.size > 0 ? `?${params}` : '';
  return `/reports/trial-balance${queryParams}`;
}

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  AUTH_CALLBACK: '/auth/callback',
  ACCEPT_INVITATION: (token = ':token') => `/accept-invitation/${token}`,
  NETWORK_ERROR: '/network-error',

  CHARGES: {
    ROOT: '/charges',
    ALL: (filter?: ChargeFilter | null, page?: number) =>
      `/charges${getAllChargesParams(filter, page)}`,
    MISSING_INFO: '/charges/missing-info',
    LEDGER_VALIDATION: '/charges/ledger-validation',
    DETAIL: (chargeId: string) => `/charges/${chargeId}`,
  },

  BUSINESSES: {
    ROOT: '/businesses',
    ALL: '/businesses',
    LEDGER: '/businesses/ledger',
    CONTRACTS: '/businesses/contracts',
    DETAIL: (businessId: string) => `/businesses/${businessId}`,
    DETAIL_LEDGER: (businessId: string) => `/businesses/${businessId}/ledger`,
  },

  BUSINESS_TRIPS: {
    ROOT: '/business-trips',
    ALL: '/business-trips',
    DETAIL: (businessTripId: string) => `/business-trips/${businessTripId}`,
  },

  CHARTS: {
    ROOT: '/charts',
    MAIN: '/charts',
    MONTHLY_INCOME_EXPENSE: '/charts/monthly-income-expense',
  },

  DOCUMENTS: {
    ROOT: '/documents',
    ALL: '/documents',
    ISSUE_DOCUMENT: '/documents/issue-document',
    ISSUE_DOCUMENTS: '/documents/issue-documents',
  },

  REPORTS: {
    ROOT: '/reports',
    TRIAL_BALANCE: (filter?: TrialBalanceReportFilters | null) =>
      `/reports/trial-balance${getTrialBalanceReportHref(filter)}`,
    CONTO: (filter?: ContoReportFiltersType | null) =>
      `/reports/conto${getContoReportParams(filter)}`,
    VAT_MONTHLY: '/reports/vat-monthly',
    PROFIT_AND_LOSS: (year?: number) =>
      year ? `/reports/profit-and-loss/${year}` : '/reports/profit-and-loss',
    TAX: (year?: number) => (year ? `/reports/tax/${year}` : '/reports/tax'),
    DEPRECIATION: '/reports/depreciation',
    SHAAM_6111: '/reports/shaam6111',
    YEARLY_LEDGER: '/reports/yearly-ledger',
    ANNUAL_REVENUE: '/reports/annual-revenue',
    CORPORATE_TAX_RULING_COMPLIANCE: (year?: number) =>
      year
        ? `/reports/corporate-tax-ruling-compliance/${year}`
        : '/reports/corporate-tax-ruling-compliance',
    BALANCE: '/reports/balance',
    VALIDATE_REPORTS: '/reports/validate-reports',
  },

  BANK_DEPOSITS: {
    ROOT: '/bank-deposits',
    ALL: '/bank-deposits',
  },

  WORKFLOWS: {
    ROOT: '/workflows',
    ANNUAL_AUDIT: '/workflows/annual-audit',
  },

  ACCOUNTANT_APPROVALS: '/accountant-approvals',
  SALARIES: '/salaries',
  TAGS: '/tags',
  TAX_CATEGORIES: '/tax-categories',
  SORT_CODES: '/sort-codes',
} as const;

/**
 * Type helper to extract all valid route paths
 */
export type RoutePath = string;

/**
 * Helper to check if a path matches a route pattern
 */
export function matchesRoute(currentPath: string, routePattern: string): boolean {
  // Simple matcher - can be enhanced with path-to-regexp if needed
  const pattern = routePattern.replace(/:[^/]+/g, '[^/]+');
  const regex = new RegExp(`^${pattern}$`);
  return regex.test(currentPath);
}
