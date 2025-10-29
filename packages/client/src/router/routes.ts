/**
 * Type-safe route definitions for the application
 *
 * Usage:
 * - navigate(ROUTES.CHARGES.DETAIL('charge-123'))
 * - <Link to={ROUTES.REPORTS.TAX(2024)}>Tax Report</Link>
 */

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  NETWORK_ERROR: '/network-error',

  CHARGES: {
    ROOT: '/charges',
    ALL: '/charges',
    MISSING_INFO: '/charges/missing-info',
    LEDGER_VALIDATION: '/charges/ledger-validation',
    DETAIL: (chargeId: string) => `/charges/${chargeId}`,
  },

  BUSINESSES: {
    ROOT: '/businesses',
    ALL: '/businesses',
    LEDGER: '/businesses/ledger',
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
    TRIAL_BALANCE: '/reports/trial-balance',
    CONTO: '/reports/conto',
    VAT_MONTHLY: '/reports/vat-monthly',
    PROFIT_AND_LOSS: (year?: number) =>
      year ? `/reports/profit-and-loss/${year}` : '/reports/profit-and-loss',
    TAX: (year?: number) => (year ? `/reports/tax/${year}` : '/reports/tax'),
    DEPRECIATION: '/reports/depreciation',
    SHAAM_6111: '/reports/shaam6111',
    YEARLY_LEDGER: '/reports/yearly-ledger',
    CORPORATE_TAX_RULING_COMPLIANCE: (year?: number) =>
      year
        ? `/reports/corporate-tax-ruling-compliance/${year}`
        : '/reports/corporate-tax-ruling-compliance',
    BALANCE: '/reports/balance',
    VALIDATE_REPORTS: '/reports/validate-reports',
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
