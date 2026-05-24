export const AUTH0_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Login was cancelled or permissions were not granted.',
  unauthorized: 'Invalid email or password. Please try again.',
  too_many_attempts: 'Too many login attempts. Your account is temporarily blocked.',
  consent_required: 'Additional permissions are required to continue.',
  login_required: 'Please log in to continue.',
  invalid_token: 'Your session has expired. Please log in again.',
};

// Auth0 error codes that mean the user must authenticate interactively again:
// the refresh token is unknown/invalid/expired/missing, so silent renewal can never succeed.
const REAUTH_REQUIRED_ERROR_CODES = new Set([
  'login_required',
  'invalid_token',
  'invalid_grant',
  'missing_refresh_token',
]);

export function isReauthRequiredAuth0Error(error: Error & { error?: string }): boolean {
  return error.error != null && REAUTH_REQUIRED_ERROR_CODES.has(error.error);
}

export function isNetworkError(error: Error & { error?: string }): boolean {
  return (
    error.error === 'network_error' ||
    error.message?.toLowerCase().includes('network') ||
    error.message?.toLowerCase().includes('fetch')
  );
}
export function getAuth0ErrorMessage(error: Error & { error?: string }): string {
  if (error.error && AUTH0_ERROR_MESSAGES[error.error]) {
    return AUTH0_ERROR_MESSAGES[error.error];
  }
  if (isNetworkError(error)) {
    return 'Network error — please check your connection and try again.';
  }
  return 'An unexpected error occurred. Please try again.';
}
