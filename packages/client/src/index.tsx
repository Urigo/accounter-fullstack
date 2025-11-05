import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './router/config.js';
import './index.css';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement!);

// Create router with object-based configuration
const router = createBrowserRouter(routes);

root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
