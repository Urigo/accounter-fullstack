import { lazy, Suspense, type ReactElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ErrorBoundary } from '../components/error-boundary.js';
import { PageSkeleton, ReportSkeleton, TableSkeleton } from '../components/layout/page-skeleton.js';
import { DashboardLayoutRoute } from './layouts/dashboard-layout.js';
import { RootLayout } from './layouts/root-layout.js';
import { businessLoader, chargeLoader, publicOnly, requireAuth } from './loaders/index.js';
import { ROUTES } from './routes.js';

/**
 * Lazy load page components for code splitting
 * Components use named exports, so we need to extract them
 */

// Charges
const AllCharges = lazy(() =>
  import('../components/screens/charges/all-charges.js').then(m => ({ default: m.AllCharges })),
);
const MissingInfoCharges = lazy(() =>
  import('../components/screens/charges/missing-info-charges.js').then(m => ({
    default: m.MissingInfoCharges,
  })),
);
const Charge = lazy(() =>
  import('../components/screens/charges/charge.js').then(m => ({ default: m.Charge })),
);
const ChargesLedgerValidation = lazy(() =>
  import('../components/charges-ledger-validation.js').then(m => ({
    default: m.ChargesLedgerValidation,
  })),
);

// Businesses
const Businesses = lazy(() =>
  import('../components/businesses/index.js').then(m => ({ default: m.Businesses })),
);
const BusinessScreen = lazy(() =>
  import('../components/screens/businesses/business.js').then(m => ({ default: m.BusinessScreen })),
);
const BusinessTransactionsSummery = lazy(() =>
  import('../components/business-transactions/index.js').then(m => ({
    default: m.BusinessTransactionsSummery,
  })),
);
const BusinessTransactionsSingle = lazy(() =>
  import('../components/business-transactions/business-transactions-single.js').then(m => ({
    default: m.BusinessTransactionsSingle,
  })),
);

// Business Trips
const BusinessTrips = lazy(() =>
  import('../components/business-trips/index.js').then(m => ({ default: m.BusinessTrips })),
);
const BusinessTrip = lazy(() =>
  import('../components/business-trips/business-trip.js').then(m => ({ default: m.BusinessTrip })),
);

// Charts
const ChartPage = lazy(() =>
  import('../components/charts/index.js').then(m => ({ default: m.ChartPage })),
);
const MonthlyIncomeExpenseChart = lazy(() =>
  import('../components/charts/monthly-income-expense/index.js').then(m => ({
    default: m.MonthlyIncomeExpenseChart,
  })),
);

// Documents
const DocumentsReport = lazy(() =>
  import('../components/screens/documents/all-documents/index.jsx').then(m => ({
    default: m.DocumentsReport,
  })),
);
const IssueDocumentScreen = lazy(() =>
  import('../components/screens/documents/issue-document.js').then(m => ({
    default: m.IssueDocumentScreen,
  })),
);
const IssueDocuments = lazy(() =>
  import('../components/screens/documents/issue-documents/index.js').then(m => ({
    default: m.IssueDocuments,
  })),
);

// Reports
const TrialBalanceReport = lazy(() =>
  import('../components/reports/trial-balance-report/index.js').then(m => ({
    default: m.TrialBalanceReport,
  })),
);
const ContoReport = lazy(() =>
  import('../components/reports/conto/index.js').then(m => ({ default: m.ContoReport })),
);
const VatMonthlyReport = lazy(() =>
  import('../components/reports/vat-monthly-report/index.js').then(m => ({
    default: m.VatMonthlyReport,
  })),
);
const ProfitAndLossReport = lazy(() =>
  import('../components/reports/profit-and-loss-report/index.js').then(m => ({
    default: m.ProfitAndLossReport,
  })),
);
const TaxReport = lazy(() =>
  import('../components/reports/tax-report/index.js').then(m => ({ default: m.TaxReport })),
);
const DepreciationReport = lazy(() =>
  import('../components/screens/reports/depreciation-report/index.js').then(m => ({
    default: m.DepreciationReport,
  })),
);
const Shaam6111Report = lazy(() =>
  import('../components/screens/reports/shaam6111-report/index.js').then(m => ({
    default: m.Shaam6111Report,
  })),
);
const YearlyLedgerReport = lazy(() =>
  import('../components/reports/yearly-ledger/index.js').then(m => ({
    default: m.YearlyLedgerReport,
  })),
);
const CorporateTaxRulingComplianceReport = lazy(() =>
  import('../components/reports/corporate-tax-ruling-compliance-report/index.js').then(m => ({
    default: m.CorporateTaxRulingComplianceReport,
  })),
);
const BalanceReport = lazy(() =>
  import('../components/screens/reports/balance-report/index.js').then(m => ({
    default: m.BalanceReport,
  })),
);
const ValidateReportsScreen = lazy(() =>
  import('../components/reports/validations/index.js').then(m => ({
    default: m.ValidateReportsScreen,
  })),
);
const AccountantApprovals = lazy(() =>
  import('../components/reports/accountant-approvals.js').then(m => ({
    default: m.AccountantApprovals,
  })),
);

// Other
const Salaries = lazy(() =>
  import('../components/salaries/index.js').then(m => ({ default: m.Salaries })),
);
const TagsManager = lazy(() =>
  import('../components/tags/index.js').then(m => ({ default: m.TagsManager })),
);
const TaxCategories = lazy(() =>
  import('../components/tax-categories/index.js').then(m => ({ default: m.TaxCategories })),
);
const SortCodes = lazy(() =>
  import('../components/screens/sort-codes/index.js').then(m => ({ default: m.SortCodes })),
);
const PageNotFound = lazy(() =>
  import('../components/screens/page-not-found.js').then(m => ({ default: m.PageNotFound })),
);

// Auth
const LoginPage = lazy(() =>
  import('../components/login-page.js').then(m => ({ default: m.LoginPage })),
);

/**
 * Helper to wrap components with Suspense
 */
function withSuspense(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: React.LazyExoticComponent<React.ComponentType<any>>,
  fallback?: ReactElement,
) {
  return (
    <Suspense fallback={fallback || <PageSkeleton />}>
      <Component />
    </Suspense>
  );
}

/**
 * Application route configuration
 * Using object-based routes for better type safety and features
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      // Public routes (login, error pages)
      {
        path: ROUTES.LOGIN,
        loader: publicOnly,
        element: withSuspense(LoginPage),
        handle: {
          title: 'Login',
        },
      },

      // Protected routes (require authentication)
      {
        path: '/',
        loader: requireAuth,
        element: <DashboardLayoutRoute />,
        errorElement: <ErrorBoundary />,
        children: [
          // Home / Charges (default)
          {
            index: true,
            element: withSuspense(AllCharges, <TableSkeleton />),
            handle: {
              title: 'All Charges',
              breadcrumb: 'Charges',
            },
          },

          // Charges section
          {
            path: 'charges',
            handle: { breadcrumb: 'Charges' },
            children: [
              {
                index: true,
                element: withSuspense(AllCharges, <TableSkeleton />),
                handle: { title: 'All Charges' },
              },
              {
                path: 'missing-info',
                element: withSuspense(MissingInfoCharges, <TableSkeleton />),
                handle: {
                  title: 'Missing Info Charges',
                  breadcrumb: 'Missing Info',
                },
              },
              {
                path: 'ledger-validation',
                element: withSuspense(ChargesLedgerValidation, <TableSkeleton />),
                handle: {
                  title: 'Ledger Validation',
                  breadcrumb: 'Ledger Validation',
                },
              },
              {
                path: ':chargeId',
                loader: chargeLoader,
                element: withSuspense(Charge),
                handle: {
                  title: 'Charge Details',
                  breadcrumb: 'Details',
                },
              },
            ],
          },

          // Businesses section
          {
            path: 'businesses',
            handle: { breadcrumb: 'Businesses' },
            children: [
              {
                index: true,
                element: withSuspense(Businesses, <TableSkeleton />),
                handle: { title: 'All Businesses' },
              },
              {
                path: 'transactions',
                element: withSuspense(BusinessTransactionsSummery, <TableSkeleton />),
                handle: {
                  title: 'Business Transactions Summary',
                  breadcrumb: 'Transactions',
                },
              },
              {
                path: ':businessId',
                loader: businessLoader,
                element: withSuspense(BusinessScreen),
                handle: {
                  title: 'Business Details',
                  breadcrumb: 'Details',
                },
              },
              {
                path: ':businessId/transactions',
                element: withSuspense(BusinessTransactionsSingle, <TableSkeleton />),
                handle: {
                  title: 'Business Transactions',
                  breadcrumb: 'Transactions',
                },
              },
            ],
          },

          // Business Trips section
          {
            path: 'business-trips',
            handle: { breadcrumb: 'Business Trips' },
            children: [
              {
                index: true,
                element: withSuspense(BusinessTrips, <TableSkeleton />),
                handle: { title: 'Business Trips' },
              },
              {
                path: ':businessTripId',
                element: withSuspense(BusinessTrip),
                handle: {
                  title: 'Business Trip Details',
                  breadcrumb: 'Details',
                },
              },
            ],
          },

          // Charts section
          {
            path: 'charts',
            handle: { breadcrumb: 'Charts' },
            children: [
              {
                index: true,
                element: withSuspense(ChartPage),
                handle: { title: 'Charts' },
              },
              {
                path: 'monthly-income-expense',
                element: withSuspense(MonthlyIncomeExpenseChart),
                handle: {
                  title: 'Monthly Income/Expense',
                  breadcrumb: 'Income/Expense',
                },
              },
            ],
          },

          // Documents section
          {
            path: 'documents',
            handle: { breadcrumb: 'Documents' },
            children: [
              {
                index: true,
                element: withSuspense(DocumentsReport, <TableSkeleton />),
                handle: { title: 'All Documents' },
              },
              {
                path: 'issue-document',
                element: withSuspense(IssueDocumentScreen),
                handle: {
                  title: 'Issue Document',
                  breadcrumb: 'Issue Document',
                },
              },
              {
                path: 'issue-documents',
                element: withSuspense(IssueDocuments),
                handle: {
                  title: 'Issue Documents',
                  breadcrumb: 'Issue Documents',
                },
              },
            ],
          },

          // Reports section
          {
            path: 'reports',
            handle: { breadcrumb: 'Reports' },
            children: [
              {
                path: 'trial-balance',
                element: withSuspense(TrialBalanceReport, <ReportSkeleton />),
                handle: {
                  title: 'Trial Balance Report',
                  breadcrumb: 'Trial Balance',
                },
              },
              {
                path: 'conto',
                element: withSuspense(ContoReport, <ReportSkeleton />),
                handle: {
                  title: 'Conto Report',
                  breadcrumb: 'Conto',
                },
              },
              {
                path: 'vat-monthly',
                element: withSuspense(VatMonthlyReport, <ReportSkeleton />),
                handle: {
                  title: 'VAT Monthly Report',
                  breadcrumb: 'VAT Monthly',
                },
              },
              {
                path: 'profit-and-loss',
                handle: { breadcrumb: 'Profit & Loss' },
                children: [
                  {
                    index: true,
                    element: withSuspense(ProfitAndLossReport, <ReportSkeleton />),
                    handle: { title: 'Profit & Loss Report' },
                  },
                  {
                    path: ':year',
                    element: withSuspense(ProfitAndLossReport, <ReportSkeleton />),
                    handle: {
                      title: 'Profit & Loss Report',
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loader data type varies by route
                      breadcrumb: (data: any) => data?.year || 'Year',
                    },
                  },
                ],
              },
              {
                path: 'tax',
                handle: { breadcrumb: 'Tax' },
                children: [
                  {
                    index: true,
                    element: withSuspense(TaxReport, <ReportSkeleton />),
                    handle: { title: 'Tax Report' },
                  },
                  {
                    path: ':year',
                    element: withSuspense(TaxReport, <ReportSkeleton />),
                    handle: {
                      title: 'Tax Report',
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loader data type varies by route
                      breadcrumb: (data: any) => data?.year || 'Year',
                    },
                  },
                ],
              },
              {
                path: 'depreciation',
                element: withSuspense(DepreciationReport, <ReportSkeleton />),
                handle: {
                  title: 'Depreciation Report',
                  breadcrumb: 'Depreciation',
                },
              },
              {
                path: 'shaam-6111',
                element: withSuspense(Shaam6111Report, <ReportSkeleton />),
                handle: {
                  title: 'Shaam 6111 Report',
                  breadcrumb: 'Shaam 6111',
                },
              },
              {
                path: 'yearly-ledger',
                element: withSuspense(YearlyLedgerReport, <ReportSkeleton />),
                handle: {
                  title: 'Yearly Ledger Report',
                  breadcrumb: 'Yearly Ledger',
                },
              },
              {
                path: 'corporate-tax-ruling-compliance',
                handle: { breadcrumb: 'Tax Ruling' },
                children: [
                  {
                    index: true,
                    element: withSuspense(CorporateTaxRulingComplianceReport, <ReportSkeleton />),
                    handle: { title: 'Corporate Tax Ruling Compliance Report' },
                  },
                  {
                    path: ':year',
                    element: withSuspense(CorporateTaxRulingComplianceReport, <ReportSkeleton />),
                    handle: {
                      title: 'Corporate Tax Ruling Compliance Report',
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loader data type varies by route
                      breadcrumb: (data: any) => data?.year || 'Year',
                    },
                  },
                ],
              },
              {
                path: 'balance',
                element: withSuspense(BalanceReport, <ReportSkeleton />),
                handle: {
                  title: 'Balance Report',
                  breadcrumb: 'Balance',
                },
              },
              {
                path: 'validate-reports',
                element: withSuspense(ValidateReportsScreen),
                handle: {
                  title: 'Validate Reports',
                  breadcrumb: 'Validate',
                },
              },
            ],
          },

          // Standalone routes
          {
            path: 'accountant-approvals',
            element: withSuspense(AccountantApprovals, <TableSkeleton />),
            handle: { title: 'Accountant Approvals', breadcrumb: 'Accountant Approvals' },
          },
          {
            path: 'salaries',
            element: withSuspense(Salaries, <TableSkeleton />),
            handle: { title: 'Salaries', breadcrumb: 'Salaries' },
          },
          {
            path: 'tags',
            element: withSuspense(TagsManager),
            handle: { title: 'Tags', breadcrumb: 'Tags' },
          },
          {
            path: 'tax-categories',
            element: withSuspense(TaxCategories),
            handle: { title: 'Tax Categories', breadcrumb: 'Tax Categories' },
          },
          {
            path: 'sort-codes',
            element: withSuspense(SortCodes),
            handle: { title: 'Sort Codes', breadcrumb: 'Sort Codes' },
          },

          // 404 catch-all
          {
            path: '*',
            element: withSuspense(PageNotFound),
            handle: { title: 'Page Not Found' },
          },
        ],
      },
    ],
  },
];
