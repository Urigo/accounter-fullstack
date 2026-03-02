import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import { routes } from './router/config.js';
import './index.css';
import 'json-bigint-patch';
import { ROUTES } from '@/router/routes.js';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement!);

// Create router with object-based configuration
const router = createBrowserRouter(routes);

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
const redirectUri = `${window.location.origin}${ROUTES.AUTH_CALLBACK}`;
const shouldSkipRedirectCallback = window.location.pathname === ROUTES.AUTH_CALLBACK;

if (!domain || !clientId || !audience) {
  console.warn('Auth0 environment variables not set. Auth0 login will fail.');
}

root.render(
  <StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience,
        scope: 'openid profile email offline_access',
      }}
      cacheLocation="localstorage"
      useRefreshTokens
      skipRedirectCallback={shouldSkipRedirectCallback}
    >
      <RouterProvider router={router} />
    </Auth0Provider>
  </StrictMode>,
);
