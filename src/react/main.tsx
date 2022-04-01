import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FinancialStatus } from './comnponents/FinancialStatus';

const rootElement = document.getElementById('root');

const root = createRoot(rootElement!);

root.render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FinancialStatus />} />
        <Route path="/test1" element={<div>test1</div>} />
        <Route path="/test2" element={<div>test2</div>} />
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
