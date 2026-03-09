import { describe, expect, it } from 'vitest';
import { mapAuth0Error } from '../invitations.helper.js';

describe('mapAuth0Error', () => {
  it('maps rate-limit errors and exposes retryAfter metadata', () => {
    const error = {
      message: 'Too many requests',
      statusCode: 429,
      headers: {
        'retry-after': '60',
      },
    };

    const result = mapAuth0Error(error);

    expect(result.message).toBe('Auth0 rate limit exceeded. Please retry shortly.');
    expect(result.extensions?.code).toBe('RATE_LIMITED');
    expect(result.extensions?.retryAfter).toBe(60);
  });

  it('maps already-exists errors', () => {
    const error = {
      message: 'The user already exists',
      statusCode: 409,
    };

    const result = mapAuth0Error(error);

    expect(result.message).toBe('User already exists in Auth0');
    expect(result.extensions?.code).toBe('USER_ALREADY_EXISTS');
  });

  it('sanitizes unknown Auth0 errors', () => {
    const error = {
      message: 'database timeout for tenant abc, request_id=secret-123',
      statusCode: 500,
    };

    const result = mapAuth0Error(error);

    expect(result.message).toBe('Failed to create user in identity provider.');
    expect(result.extensions?.code).toBe('AUTH0_ERROR');
    expect(result.message).not.toContain('secret-123');
    expect(result.message).not.toContain('tenant');
  });
});
