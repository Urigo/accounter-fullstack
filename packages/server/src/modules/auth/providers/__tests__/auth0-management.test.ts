import { ManagementClient } from 'auth0';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Auth0ManagementProvider } from '../auth0-management.provider.js';
import type { Environment } from '../../../../shared/types/index.js';

// Mock auth0 library
vi.mock('auth0', () => {
  const users = {
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    listUsersByEmail: vi.fn(),
  };
  const tickets = {
    changePassword: vi.fn(),
  };
  const ManagementClient = vi.fn(function() {
    return {
        users,
        tickets,
    }
});
  return { ManagementClient };
});

describe('Auth0ManagementProvider', () => {
  let service: Auth0ManagementProvider;
  let mockClient: any;
  let mockEnv: Environment;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock environment
    mockEnv = {
      auth0: {
        domain: 'test-domain',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        audience: 'test-audience',
        managementAudience: 'test-management-audience',
      },
      general: {
        frontendUrl: 'http://localhost:3000',
      },
      // minimal mock
    } as any;

    service = new Auth0ManagementProvider(mockEnv);
    // Get the instance of the mocked client
    mockClient = (ManagementClient as any).mock.results[0].value;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should initialize ManagementClient with correct config', () => {
    expect(ManagementClient).toHaveBeenCalledWith({
      domain: 'test-domain',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      audience: 'test-management-audience',
    });
  });

  it('should return existing user id if user already exists', async () => {
    const email = 'existing@example.com';
    const existingUserId = 'auth0|existing';

    mockClient.users.listUsersByEmail.mockResolvedValue([{ user_id: existingUserId }]);

    const result = await service.createBlockedUser(email);

    expect(result).toEqual({ userId: existingUserId, created: false });
    expect(mockClient.users.create).not.toHaveBeenCalled();
  });

  it('prefers the database-connection user when several users share an email', async () => {
    mockClient.users.listUsersByEmail.mockResolvedValue([
      {
        user_id: 'google-oauth2|older',
        created_at: '2024-01-01T00:00:00.000Z',
        identities: [{ connection: 'google-oauth2' }],
      },
      {
        user_id: 'auth0|newer',
        created_at: '2025-01-01T00:00:00.000Z',
        identities: [{ connection: 'Username-Password-Authentication' }],
      },
    ]);

    await expect(service.getUserByEmail('multi@example.com')).resolves.toBe('auth0|newer');
  });

  it('picks the oldest user when no database-connection user shares the email', async () => {
    mockClient.users.listUsersByEmail.mockResolvedValue([
      {
        user_id: 'google-oauth2|newer',
        created_at: '2025-01-01T00:00:00.000Z',
        identities: [{ connection: 'google-oauth2' }],
      },
      {
        user_id: 'github|older',
        created_at: '2024-01-01T00:00:00.000Z',
        identities: [{ connection: 'github' }],
      },
    ]);

    await expect(service.getUserByEmail('multi@example.com')).resolves.toBe('github|older');
  });

  describe('isUnusedInvitationUser', () => {
    it('is true for a never-used user provisioned by accounter', async () => {
      mockClient.users.get.mockResolvedValue({
        user_id: 'auth0|placeholder',
        logins_count: 0,
        app_metadata: { registered_by: 'accounter' },
      });

      await expect(service.isUnusedInvitationUser('auth0|placeholder')).resolves.toBe(true);
    });

    it('is false for a user that has logged in', async () => {
      mockClient.users.get.mockResolvedValue({
        user_id: 'auth0|placeholder',
        logins_count: 3,
        last_login: '2026-01-01T00:00:00.000Z',
        app_metadata: { registered_by: 'accounter' },
      });

      await expect(service.isUnusedInvitationUser('auth0|placeholder')).resolves.toBe(false);
    });

    it('is false for a user not provisioned by accounter', async () => {
      mockClient.users.get.mockResolvedValue({
        user_id: 'google-oauth2|someone',
        logins_count: 0,
        app_metadata: {},
      });

      await expect(service.isUnusedInvitationUser('google-oauth2|someone')).resolves.toBe(false);
    });

    it('is false when the lookup fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mockClient.users.get.mockRejectedValue(new Error('Not found'));

      await expect(service.isUnusedInvitationUser('auth0|missing')).resolves.toBe(false);
    });
  });

  it('should create a blocked user with temporary password', async () => {
    const email = 'test@example.com';
    const mockUserId = 'auth0|123456';

    mockClient.users.listUsersByEmail.mockResolvedValue([]);
    mockClient.users.create.mockResolvedValue({
      user_id: mockUserId,
    });

    const result = await service.createBlockedUser(email);

    expect(result).toEqual({ userId: mockUserId, created: true });
    expect(mockClient.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        connection: 'Username-Password-Authentication',
        email,
        blocked: true,
        email_verified: false,
        app_metadata: {
            registered_by: 'accounter',
        },
      }),
    );
    
    // Verify password complexity requirements
    const callArgs = mockClient.users.create.mock.calls[0][0];
    const password = callArgs.password;
    expect(password.length).toBeGreaterThanOrEqual(8);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
    // eslint-disable-next-line no-useless-escape
    expect(/[!@#$%^&*()_+~`|}{[\]:;?><,./\-=]/.test(password)).toBe(true);
  });

  it('should unblock a user', async () => {
    const userId = 'auth0|123456';
    mockClient.users.update.mockResolvedValue({});

    await service.unblockUser(userId);

    expect(mockClient.users.update).toHaveBeenCalledWith(
      userId,
      { blocked: false }
    );
  });

  it('should delete a user', async () => {
    const userId = 'auth0|123456';
    
    mockClient.users.delete.mockResolvedValue({});

    await service.deleteUser(userId);

    expect(mockClient.users.delete).toHaveBeenCalledWith(userId);
  });

  it('should send password reset email (trigger ticket)', async () => {
    const userId = 'auth0|123456';
    const mockTicket = 'https://auth0.com/ticket';
    
    mockClient.tickets.changePassword.mockResolvedValue({ ticket: mockTicket });

    const ticket = await service.sendPasswordResetEmail(userId);

    // Should return the ticket URL
    expect(ticket).toBe(mockTicket);

    // Should NOT assume verified before reset
    expect(mockClient.users.update).not.toHaveBeenCalledWith(
      { id: userId },
      { email_verified: true }
    );

    // Should trigger password change with mark_email_as_verified: true
    expect(mockClient.tickets.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        mark_email_as_verified: true,
        result_url: 'http://localhost:3000/login',
      })
    );
  });

  it('should throw error if creation fails', async () => {
    mockClient.users.listUsersByEmail.mockResolvedValue([]);
    mockClient.users.create.mockRejectedValue(new Error('Auth0 Error'));

    await expect(service.createBlockedUser('fail@test.com')).rejects.toThrow('Failed to create Auth0 user: Auth0 Error');
  });

  it('getUserProfileById returns email + name and caches the result', async () => {
    const userId = 'auth0|profile';
    mockClient.users.get.mockResolvedValue({ email: 'ada@example.com', name: 'Ada Lovelace' });

    const first = await service.getUserProfileById(userId);
    const second = await service.getUserProfileById(userId);

    expect(first).toEqual({ email: 'ada@example.com', name: 'Ada Lovelace' });
    expect(second).toEqual({ email: 'ada@example.com', name: 'Ada Lovelace' });
    // Second call is served from the in-memory cache, not a second Auth0 request.
    expect(mockClient.users.get).toHaveBeenCalledTimes(1);
  });

  it('getUserProfileById returns null on failure and does not cache it', async () => {
    const userId = 'auth0|transient';
    mockClient.users.get.mockRejectedValueOnce(new Error('boom'));

    const failed = await service.getUserProfileById(userId);
    expect(failed).toBeNull();

    // A failed lookup is not cached, so a later call retries Auth0.
    mockClient.users.get.mockResolvedValueOnce({ email: 'x@example.com', name: null });
    const retry = await service.getUserProfileById(userId);

    expect(retry).toEqual({ email: 'x@example.com', name: null });
    expect(mockClient.users.get).toHaveBeenCalledTimes(2);
  });
});
