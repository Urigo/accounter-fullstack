import { describe, expect, it } from 'vitest';
import {
  AUTH0_ERROR_MESSAGES,
  getAuth0ErrorMessage,
  isReauthRequiredAuth0Error,
} from '../auth0-errors.js';

describe('AUTH0_ERROR_MESSAGES', () => {
  it('maps all expected Auth0 error codes to human-readable messages', () => {
    expect(AUTH0_ERROR_MESSAGES.access_denied).toBe(
      'Login was cancelled or permissions were not granted.',
    );
    expect(AUTH0_ERROR_MESSAGES.unauthorized).toBe('Invalid email or password. Please try again.');
    expect(AUTH0_ERROR_MESSAGES.too_many_attempts).toBe(
      'Too many login attempts. Your account is temporarily blocked.',
    );
    expect(AUTH0_ERROR_MESSAGES.consent_required).toBe(
      'Additional permissions are required to continue.',
    );
    expect(AUTH0_ERROR_MESSAGES.login_required).toBe('Please log in to continue.');
    expect(AUTH0_ERROR_MESSAGES.invalid_token).toBe(
      'Your session has expired. Please log in again.',
    );
  });
});

describe('getAuth0ErrorMessage', () => {
  it('returns mapped message for known error code', () => {
    const error = Object.assign(new Error('Denied by user'), { error: 'access_denied' });

    expect(getAuth0ErrorMessage(error)).toBe(
      'Login was cancelled or permissions were not granted.',
    );
  });

  it('returns network message for network-related errors', () => {
    const error = new Error('Network request failed');

    expect(getAuth0ErrorMessage(error)).toBe(
      'Network error — please check your connection and try again.',
    );
  });

  it('returns generic message for unknown errors', () => {
    const error = new Error('Something unexpected happened');

    expect(getAuth0ErrorMessage(error)).toBe('An unexpected error occurred. Please try again.');
  });
});

describe('isReauthRequiredAuth0Error', () => {
  it.each(['login_required', 'invalid_token', 'invalid_grant', 'missing_refresh_token'])(
    'treats %s as requiring interactive re-authentication',
    code => {
      const error = Object.assign(new Error('refresh failed'), { error: code });

      expect(isReauthRequiredAuth0Error(error)).toBe(true);
    },
  );

  it('does not treat network errors as requiring re-authentication', () => {
    const error = Object.assign(new Error('Network request failed'), { error: 'network_error' });

    expect(isReauthRequiredAuth0Error(error)).toBe(false);
  });

  it('returns false for unknown or missing error codes', () => {
    expect(isReauthRequiredAuth0Error(new Error('no code'))).toBe(false);
    expect(
      isReauthRequiredAuth0Error(Object.assign(new Error('weird'), { error: 'something_else' })),
    ).toBe(false);
  });
});
