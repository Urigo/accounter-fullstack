import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route,Routes } from 'react-router-dom';

import { AllCharges } from './components/all-charges';
import { AllUsers } from './components/all-users';
import { DocumentsReport } from './components/documents';
import { FinancialStatus } from './components/financial-status';
import { MonthlyReport } from './components/monthly-report';
import { ReportsToReview } from './components/reports-to-review';
import { TopPrivateNotCategorized } from './components/top-private-not-categorized';
import { UserTransactions } from './components/user-transactions';
import { Providers } from './providers';

const rootElement = document.getElementById('root');

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = createRoot(rootElement!);

root.render(
  <StrictMode>
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<FinancialStatus />} />
          <Route path="/financial-status" element={<FinancialStatus />} />
          <Route path="/all-charges" element={<AllCharges />} />
          <Route path="/monthly-report" element={<MonthlyReport />} />
          <Route path="/reports-to-review" element={<ReportsToReview />} />
          <Route path="/documents" element={<DocumentsReport />} />
          <Route path="/private-charts" element={<TopPrivateNotCategorized />} />
          <Route path="/user-transactions" element={<UserTransactions />} />
          <Route path="/all-users" element={<AllUsers />} />
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
  </StrictMode>
);
