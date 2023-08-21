import { ReactElement, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AllCharges } from './components/all-charges';
import { BusinessTransactionsSummery } from './components/business-transactions';
import { ChartPage } from './components/charts';
import { Footer } from './components/common';
import { NavBar } from './components/common/menu';
import { DocumentsReport } from './components/documents';
import { TrialBalanceReport } from './components/reports/trial-balance-report';
import { VatMonthlyReport } from './components/reports/vat-monthly-report';
import { TagsManager } from './components/tags';
import { FiltersContext } from './filters-context';

export function App(): ReactElement {
  const [filtersContext, setFiltersContext] = useState('');
  return (
    <FiltersContext.Provider value={{ filtersContext, setFiltersContext }}>
      <NavBar />
      <Routes>
        <Route path="/" element={<AllCharges />} />
        <Route path="/all-charges" element={<AllCharges />} />
        <Route path="/documents" element={<DocumentsReport />} />
        <Route path="/business-transactions" element={<BusinessTransactionsSummery />} />
        <Route path="/reports/trial-balance" element={<TrialBalanceReport />} />
        <Route path="/reports/vat-monthly" element={<VatMonthlyReport />} />
        <Route path="/charts" element={<ChartPage />} />
        <Route path="/tags" element={<TagsManager />} />
        <Route
          path="*"
          element={
            <main className="p-4">
              <p>404: There&apos;s nothing here!</p>
            </main>
          }
        />
      </Routes>
      <Footer>{filtersContext}</Footer>
    </FiltersContext.Provider>
  );
}
