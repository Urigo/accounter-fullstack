import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { routes } from './router/config.js';
import './index.css';
import 'json-bigint-patch';
import { ROUTES } from '@/router/routes.js';
import { setUrqlAccessTokenProvider } from './providers/urql.js';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement!);

// Create router with object-based configuration
const router = createBrowserRouter(routes);

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_FRONTEND_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
const redirectUri = `${window.location.origin}${ROUTES.AUTH_CALLBACK}`;
const shouldSkipRedirectCallback = window.location.pathname === ROUTES.AUTH_CALLBACK;

if (!domain || !clientId || !audience) {
  console.warn('Auth0 environment variables not set. Auth0 login will fail.');
}

function Auth0UrqlTokenBridge() {
  const { getAccessTokenSilently } = useAuth0();

  // Register token provider during render so route loaders can read it immediately.
  setUrqlAccessTokenProvider(async () => {
    try {
      return await getAccessTokenSilently({
        authorizationParams: {
          audience,
          scope: 'openid profile email offline_access',
        },
      });
    } catch {
      return null;
    }
  });

  useEffect(() => {
    return () => {
      setUrqlAccessTokenProvider(null);
    };
  }, []);

  return <RouterProvider router={router} />;
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
      useRefreshTokens
      cacheLocation="localstorage"
      skipRedirectCallback={shouldSkipRedirectCallback}
    >
      <Auth0UrqlTokenBridge />
    </Auth0Provider>
  </StrictMode>,
);
