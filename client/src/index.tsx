import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AllCharges } from './components/all-charges';
import { BusinessTransactionsSummery } from './components/business-transactions';
import { DocumentsReport } from './components/documents';
import { TrialBalanceReport } from './components/reports/trial-balance-report';
import { VatMonthlyReport } from './components/reports/vat-monthly-report';
import { TagsManager } from './components/tags';
import { Providers } from './providers';
import './index.css';

const rootElement = document.getElementById('root');

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = createRoot(rootElement!);

root.render(
  <StrictMode>
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AllCharges />} />
          <Route path="/all-charges" element={<AllCharges />} />
          <Route path="/documents" element={<DocumentsReport />} />
          <Route path="/business-transactions" element={<BusinessTransactionsSummery />} />
          <Route path="/reports/trial-balance" element={<TrialBalanceReport />} />
          <Route path="/reports/vat-monthly" element={<VatMonthlyReport />} />
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
      </BrowserRouter>
    </Providers>
  </StrictMode>,
);
