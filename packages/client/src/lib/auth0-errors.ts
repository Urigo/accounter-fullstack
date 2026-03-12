export const AUTH0_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Login was cancelled or permissions were not granted.',
  unauthorized: 'Invalid email or password. Please try again.',
  too_many_attempts: 'Too many login attempts. Your account is temporarily blocked.',
  consent_required: 'Additional permissions are required to continue.',
  login_required: 'Please log in to continue.',
  invalid_token: 'Your session has expired. Please log in again.',
};

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
