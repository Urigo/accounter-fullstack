import { useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { getAuth0ErrorMessage, isNetworkError } from '../../lib/auth0-errors.js';
import { ROUTES } from '../../router/routes.js';
import { Button } from '../ui/button.jsx';

const MAX_NETWORK_RETRY_ATTEMPTS = 2;
const NETWORK_RETRY_DELAY_MS = 750;

type Auth0Error = Error & { error?: string };

export function normalizeAuth0Error(error: unknown): Auth0Error {
  if (error instanceof Error) {
    return error as Auth0Error;
  }

  const fallback = new Error('Unknown authentication error') as Auth0Error;
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as { error?: unknown; message?: unknown };
    if (typeof maybeError.error === 'string') {
      fallback.error = maybeError.error;
    }
    if (typeof maybeError.message === 'string' && maybeError.message.length > 0) {
      fallback.message = maybeError.message;
    }
  }

  return fallback;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * Calls `fn` and retries on transient network errors with linear back-off.
 * Throws the normalised error if all attempts are exhausted or the error is
 * non-retriable.
 *
 * Exported for unit testing.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  {
    maxAttempts = MAX_NETWORK_RETRY_ATTEMPTS,
    retryDelayMs = NETWORK_RETRY_DELAY_MS,
  }: { maxAttempts?: number; retryDelayMs?: number } = {},
): Promise<T> {
  let lastError!: Auth0Error;
  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (caughtError) {
      lastError = normalizeAuth0Error(caughtError);
      if (!isNetworkError(lastError) || attempt >= maxAttempts) {
        throw lastError;
      }
      await wait(retryDelayMs * (attempt + 1));
    }
  }
  throw lastError;
}

export function AuthCallbackPage(): ReactElement {
  const { handleRedirectCallback, isLoading, error, isAuthenticated, loginWithRedirect } =
    useAuth0();
  const navigate = useNavigate();
  const [callbackError, setCallbackError] = useState<Auth0Error | null>(null);
  const redirectUriOrigin = typeof window === 'undefined' ? '' : window.location.origin;

  useEffect(() => {
    if (isAuthenticated) {
      navigate(ROUTES.CHARGES.ROOT, { replace: true });
      return;
    }

    if (error) {
      setCallbackError(normalizeAuth0Error(error));
      return;
    }

    if (isLoading) {
      return;
    }

    let cancelled = false;

    const handleCallback = async (): Promise<void> => {
      try {
        const result = await retryWithBackoff(handleRedirectCallback);
        if (cancelled) {
          return;
        }
        sessionStorage.removeItem('auth:returnTo');
        const returnTo = result?.appState?.returnTo as string | undefined;
        navigate(returnTo || ROUTES.CHARGES.ROOT, { replace: true });
      } catch (caughtError) {
        if (!cancelled) {
          setCallbackError(normalizeAuth0Error(caughtError));
        }
      }
    };

    void handleCallback();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, error, handleRedirectCallback, navigate]);

  const resolvedError = callbackError ?? (error ? normalizeAuth0Error(error) : null);

  if (resolvedError) {
    const message = getAuth0ErrorMessage(resolvedError);

    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">Login Failed</h1>
          <p className="text-muted-foreground">{message}</p>
          <div className="flex gap-2 justify-center">
            <Button
              onClick={() => {
                const savedReturnTo = sessionStorage.getItem('auth:returnTo');
                return loginWithRedirect({
                  authorizationParams: {
                    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                    scope: 'openid profile email',
                    redirect_uri: `${redirectUriOrigin}${ROUTES.AUTH_CALLBACK}`,
                  },
                  appState: { returnTo: savedReturnTo ?? ROUTES.CHARGES.ROOT },
                });
              }}
            >
              Try Again
            </Button>
            <Button variant="outline" onClick={() => navigate(ROUTES.LOGIN)}>
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <div>Processing authentication...</div>;
}
