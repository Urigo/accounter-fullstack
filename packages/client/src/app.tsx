import { ReactElement, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Charge } from './components/all-charges/charge.js';
import { AllCharges } from './components/all-charges/index.js';
import { BusinessTransactionsSingle } from './components/business-transactions/business-transactions-single.js';
import { BusinessTransactionsSummery } from './components/business-transactions/index.js';
import { BusinessTrip } from './components/business-trips/business-trip.js';
import { BusinessTrips } from './components/business-trips/index.js';
import { Businesses } from './components/businesses/index.js';
import { ChargesLedgerValidation } from './components/charges-ledger-validation.js';
import { ChartPage } from './components/charts/index.js';
import { DocumentsReport } from './components/documents/index.js';
import { DashboardLayout } from './components/layout/dashboard-layout.js';
import { AccountantApprovals } from './components/reports/accountant-approvals.js';
import { ProfitAndLossReport } from './components/reports/profit-and-loss-report/index.js';
import { TaxReport } from './components/reports/tax-report/index.js';
import { TrialBalanceReport } from './components/reports/trial-balance-report/index.js';
import { VatMonthlyReport } from './components/reports/vat-monthly-report/index.js';
import { Salaries } from './components/salaries/index.js';
import { TagsManager } from './components/tags/index.js';
import { FiltersContext } from './providers/filters-context.js';

export function App(): ReactElement {
  const [filtersContext, setFiltersContext] = useState<ReactElement | null>(null);

  return (
    <FiltersContext.Provider value={{ filtersContext, setFiltersContext }}>
      <DashboardLayout filtersContext={filtersContext}>
        <Routes>
          <Route path="/" element={<AllCharges />} />
          <Route path="all-charges" element={<AllCharges />} /> {/* deprecated */}
          <Route path="charges" element={<AllCharges />} />
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
          <Route path="charts" element={<ChartPage />} />
          <Route path="documents" element={<DocumentsReport />} />
          <Route path="accountant-approvals" element={<AccountantApprovals />} />
          <Route path="reports">
            <Route path="trial-balance" element={<TrialBalanceReport />} />
            <Route path="vat-monthly" element={<VatMonthlyReport />} />
            <Route path="profit-and-loss" element={<ProfitAndLossReport />} />
            <Route path="profit-and-loss/:year" element={<ProfitAndLossReport />} />
            <Route path="tax" element={<TaxReport />} />
            <Route path="tax/:year" element={<TaxReport />} />
          </Route>
          <Route path="salaries" element={<Salaries />} />
          <Route path="tags" element={<TagsManager />} />
          <Route
            path="*"
            element={
              <main className="p-4">
                <p>404: There&apos;s nothing here!</p>
              </main>
            }
          />
        </Routes>
      </DashboardLayout>
    </FiltersContext.Provider>
  );
}
