import { ReactElement, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AllCharges } from './components/all-charges';
import { Charge } from './components/all-charges/charge';
import { BusinessTransactionsSummery } from './components/business-transactions';
import { BusinessTransactionsSingle } from './components/business-transactions/business-transactions-single';
import { BusinessTrips } from './components/business-trips';
import { BusinessTrip } from './components/business-trips/business-trip';
import { Businesses } from './components/businesses';
import { ChargesLedgerValidation } from './components/charges-ledger-validation';
import { ChartPage } from './components/charts';
import { DocumentsReport } from './components/documents';
import { DashboardLayout } from './components/layout/dashboard-layout';
import { TrialBalanceReport } from './components/reports/trial-balance-report';
import { VatMonthlyReport } from './components/reports/vat-monthly-report';
import { Salaries } from './components/salaries';
import { TagsManager } from './components/tags';
import { FiltersContext } from './providers/filters-context';

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
          <Route path="reports">
            <Route path="trial-balance" element={<TrialBalanceReport />} />
            <Route path="vat-monthly" element={<VatMonthlyReport />} />
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
