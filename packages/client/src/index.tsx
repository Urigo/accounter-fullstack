import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from 'react-router-dom';
import { App } from './app.js';
import { Providers } from './providers/index.js';
import './index.css';

const rootElement = document.getElementById('root');

const root = createRoot(rootElement!);

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      path="*"
      element={
        <Providers>
          <App />
        </Providers>
      }
      errorElement={<p>error</p>} // TODO: implement
    />,
  ),
);

root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
