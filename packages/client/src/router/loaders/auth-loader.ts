import { redirect } from 'react-router-dom';
import { UserService } from '../../services/user-service.js';
import { ROUTES } from '../routes.js';

/**
 * Auth loader - protects routes that require authentication
 * Redirects to login if user is not authenticated
 */
export function requireAuth() {
  const authService = new UserService();

  if (!authService.isLoggedIn()) {
    // Redirect to login page
    throw redirect(ROUTES.LOGIN);
  }

  return null;
}

/**
 * Public only loader - redirects authenticated users away from login page
 */
export function publicOnly() {
  const authService = new UserService();

  if (authService.isLoggedIn()) {
    // Redirect to home page if already logged in
    throw redirect(ROUTES.HOME);
  }

  return null;
}
