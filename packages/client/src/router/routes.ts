/**
 * Type-safe route definitions for the application
 *
 * Usage:
 * - navigate(ROUTES.CHARGES.DETAIL('charge-123'))
 * - <Link to={ROUTES.REPORTS.TAX(2024)}>Tax Report</Link>
 */

import type { DynamicReportFiltersType } from '@/components/reports/dynamic-report/index.js';
import type { TrialBalanceReportFilters } from '@/components/reports/trial-balance-report/trial-balance-report-filters.js';
import { DEPRECIATION_REPORT_FILTERS_QUERY_PARAM } from '@/components/screens/reports/depreciation-report/depreciation-report-filters-utils.js';
import type { ChargeFilter, DepreciationReportFilter } from '@/gql/graphql.js';
import { isObjectEmpty } from '@/helpers/form.js';

export function encodeFilters(filter?: Record<string, unknown> | null): string | null {
  return !filter || isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
}

export function getAllChargesParams(filter?: ChargeFilter | null, page?: number): string {
  const params = new URLSearchParams();
  if (page) {
    params.append('page', String(page));
  }

  const chargesFilters = encodeFilters(filter);
  if (chargesFilters) {
    // Add it as a single encoded parameter
    params.append('chargesFilters', chargesFilters);
  }

  const queryParams = params.size > 0 ? `?${params}` : '/';
  return queryParams;
}

function getDynamicReportParams(filter?: DynamicReportFiltersType | null): string {
  const params = new URLSearchParams();
  if (filter?.fromDate) params.set('from', filter.fromDate);
  if (filter?.toDate) params.set('to', filter.toDate);
  if (filter?.ownerIds?.[0]) params.set('owner', filter.ownerIds[0]);
  if (filter?.isShowZeroedAccounts) params.set('zeroed', '1');
  if (filter?.templateName) params.set('template', filter?.templateName);
  return params.size > 0 ? `?${params}` : '';
}

function getDepreciationReportParams(filter?: DepreciationReportFilter | null): string {
  const params = new URLSearchParams();
  const encoded = encodeFilters(filter);
  if (encoded) {
    params.append(DEPRECIATION_REPORT_FILTERS_QUERY_PARAM, encoded);
  }
  return params.size > 0 ? `?${params}` : '';
}

function getTrialBalanceReportHref(filter?: TrialBalanceReportFilters | null): string {
  const params = new URLSearchParams();

  const trialBalanceReportFilters = encodeFilters(filter);
  if (trialBalanceReportFilters) {
    // Add it as a single encoded parameter
    params.append('trialBalanceReportFilters', trialBalanceReportFilters);
  }

  const queryParams = params.size > 0 ? `?${params}` : '';
  return queryParams;
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
    DYNAMIC_REPORT: (filter?: DynamicReportFiltersType | null) =>
      `/reports/dynamic-report${getDynamicReportParams(filter)}`,
    VAT_MONTHLY: '/reports/vat-monthly',
    PROFIT_AND_LOSS: (year?: number) =>
      year ? `/reports/profit-and-loss/${year}` : '/reports/profit-and-loss',
    TAX: (year?: number) => (year ? `/reports/tax/${year}` : '/reports/tax'),
    DEPRECIATION: (filter?: DepreciationReportFilter | null) =>
      `/reports/depreciation${getDepreciationReportParams(filter)}`,
    SHAAM_6111: '/reports/shaam-6111',
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
    ANNUAL_AUDIT: (year?: number) =>
      year ? `/workflows/annual-audit/${year}` : '/workflows/annual-audit',
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
