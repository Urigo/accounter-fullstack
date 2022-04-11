import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AllUsers } from './components/AllUsers';
import { FinancialStatus } from './components/FinancialStatus';
import { MonthlyReport } from './components/MonthlyReport';
import { TopPrivateNotCategorized } from './components/TopPrivateNotCategorized';

const rootElement = document.getElementById('root');

const root = createRoot(rootElement!);

root.render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FinancialStatus />} />
        <Route path="/financial-status" element={<FinancialStatus />} />
        <Route path="/monthly-report" element={<MonthlyReport />} />
        <Route path="/reports-to-review" element={<div>missing</div>} />
        <Route path="/private-charts" element={<TopPrivateNotCategorized />} />
        <Route path="/generate-tax-movements" element={<div>missing</div>} />
        <Route path="/user-transactions" element={<div>missing</div>} />
        <Route path="/all-users" element={<AllUsers />} />
        <Route path="/____" element={<div>missing</div>} />
        <Route
          path="*"
          element={
            <main style={{ padding: '1rem' }}>
              <p>404: There's nothing here!</p>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
