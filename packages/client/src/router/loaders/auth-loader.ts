import { redirect } from 'react-router-dom';
import { hasStoredAuth0Session } from '../../lib/auth0-session.js';
import { ROUTES } from '../routes.js';

/**
 * Auth loader - protects routes that require authentication.
 * Uses Auth0 token presence in local storage as a lightweight pre-check.
 */
export function requireAuth() {
  if (hasStoredAuth0Session()) {
    return null;
  }

  throw redirect(ROUTES.LOGIN);
}

/**
 * Public only loader - redirects authenticated users away from login page
 */
export function publicOnly() {
  if (hasStoredAuth0Session()) {
    throw redirect(ROUTES.HOME);
  }

  return null;
}
