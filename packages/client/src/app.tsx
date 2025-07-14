import { useState, type ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { BusinessTransactionsSingle } from './components/business-transactions/business-transactions-single.js';
import { BusinessTransactionsSummery } from './components/business-transactions/index.js';
import { BusinessTrip } from './components/business-trips/business-trip.js';
import { BusinessTrips } from './components/business-trips/index.js';
import { Businesses } from './components/businesses/index.js';
import { ChargesLedgerValidation } from './components/charges-ledger-validation.js';
import { ChartPage } from './components/charts/index.js';
import { MonthlyIncomeExpenseChart } from './components/charts/monthly-income-expense/index.js';
import { DashboardLayout } from './components/layout/dashboard-layout.js';
import { AccountantApprovals } from './components/reports/accountant-approvals.js';
import { ContoReport } from './components/reports/conto/index.js';
import { CorporateTaxRulingComplianceReport } from './components/reports/corporate-tax-ruling-compliance-report/index.js';
import { ProfitAndLossReport } from './components/reports/profit-and-loss-report/index.js';
import { TaxReport } from './components/reports/tax-report/index.js';
import { TrialBalanceReport } from './components/reports/trial-balance-report/index.js';
import { ValidateReportsScreen } from './components/reports/validations/index.js';
import { VatMonthlyReport } from './components/reports/vat-monthly-report/index.js';
import { YearlyLedgerReport } from './components/reports/yearly-ledger/index.js';
import { Salaries } from './components/salaries/index.js';
import { AllCharges } from './components/screens/charges/all-charges.js';
import { Charge } from './components/screens/charges/charge.js';
import { MissingInfoCharges } from './components/screens/charges/missing-info-charges.js';
import { DocumentsReport } from './components/screens/documents/all-documents/index.jsx';
import { IssueDocumentScreen } from './components/screens/documents/issue-document.js';
import { IssueDocuments } from './components/screens/documents/issue-documents/index.js';
import { AnnualAuditFlow } from './components/screens/operations/annual-audit/index.jsx';
import { PageNotFound } from './components/screens/page-not-found.js';
import { BalanceReport } from './components/screens/reports/balance-report/index.js';
import { DepreciationReport } from './components/screens/reports/depreciation-report/index.js';
import { Shaam6111Report } from './components/screens/reports/shaam6111-report/index.js';
import { SortCodes } from './components/screens/sort-codes/index.js';
import { TagsManager } from './components/tags/index.js';
import { TaxCategories } from './components/tax-categories/index.js';
import { FiltersContext } from './providers/filters-context.js';

export function App(): ReactElement {
  const [filtersContext, setFiltersContext] = useState<ReactElement | null>(null);

  return (
    <FiltersContext.Provider value={{ filtersContext, setFiltersContext }}>
      <DashboardLayout filtersContext={filtersContext}>
        <Routes>
          <Route path="/" element={<AllCharges />} />
          <Route path="charges" element={<AllCharges />} />
          <Route path="missing-info-charges" element={<MissingInfoCharges />} />
          <Route path="charges-ledger-validation" element={<ChargesLedgerValidation />} />
          <Route path="charges/:chargeId" element={<Charge />} />
          <Route path="businesses" element={<Businesses />} />
          <Route path="business-trips" element={<BusinessTrips />} />
          <Route path="business-trips/:businessTripId" element={<BusinessTrip />} />
          <Route path="business-transactions" element={<BusinessTransactionsSummery />} />
          <Route
            path="business-transactions/:businessId"
            element={<BusinessTransactionsSingle />}
          />
          <Route path="charts">
            <Route path="" element={<ChartPage />} />
            <Route path="monthly-income-expense" element={<MonthlyIncomeExpenseChart />} />
          </Route>
          <Route path="documents">
            <Route path="" element={<DocumentsReport />} />
            <Route path="issue-documents" element={<IssueDocuments />} />
            <Route path="issue-document" element={<IssueDocumentScreen />} />
          </Route>
          <Route path="accountant-approvals" element={<AccountantApprovals />} />
          <Route path="reports">
            <Route path="trial-balance" element={<TrialBalanceReport />} />
            <Route path="conto" element={<ContoReport />} />
            <Route path="vat-monthly" element={<VatMonthlyReport />} />
            <Route path="profit-and-loss" element={<ProfitAndLossReport />} />
            <Route path="profit-and-loss/:year" element={<ProfitAndLossReport />} />
            <Route path="tax" element={<TaxReport />} />
            <Route path="tax/:year" element={<TaxReport />} />
            <Route path="depreciation" element={<DepreciationReport />} />
            <Route path="shaam6111" element={<Shaam6111Report />} />
            <Route path="yearly-ledger" element={<YearlyLedgerReport />} />
            <Route
              path="corporate-tax-ruling-compliance"
              element={<CorporateTaxRulingComplianceReport />}
            />
            <Route
              path="corporate-tax-ruling-compliance/:year"
              element={<CorporateTaxRulingComplianceReport />}
            />
            <Route path="balance" element={<BalanceReport />} />
            <Route path="validate-reports" element={<ValidateReportsScreen />} />
          </Route>
          <Route path="workflows">
            <Route path="annual-audit" element={<AnnualAuditFlow />} />
          </Route>
          <Route path="salaries" element={<Salaries />} />
          <Route path="tags" element={<TagsManager />} />
          <Route path="tax-categories" element={<TaxCategories />} />
          <Route path="sort-codes" element={<SortCodes />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </DashboardLayout>
    </FiltersContext.Provider>
  );
}
