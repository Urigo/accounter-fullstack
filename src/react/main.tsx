import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AllUsers } from './components/AllUsers';
import { FinancialStatus } from './components/FinancialStatus';
import { MonthlyReport } from './components/MonthlyReport';
import { TopPrivateNotCategorized } from './components/TopPrivateNotCategorized';
import { UserTransactions } from './components/UserTransactions';

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
        <Route path="/user-transactions" element={<UserTransactions />} />
        <Route path="/all-users" element={<AllUsers />} />
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
