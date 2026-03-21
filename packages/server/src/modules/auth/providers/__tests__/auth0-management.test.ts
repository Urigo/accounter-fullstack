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

  it('should create a blocked user with temporary password when no existing user', async () => {
    const email = 'test@example.com';
    const mockUserId = 'auth0|123456';

    mockClient.users.listUsersByEmail.mockResolvedValue([]);
    mockClient.users.create.mockResolvedValue({
      user_id: mockUserId,
    });

    const userId = await service.createBlockedUser(email);

    expect(userId).toBe(mockUserId);
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

  it('should reuse and re-block existing Auth0 user instead of creating a new one', async () => {
    const email = 'existing@example.com';
    const existingUserId = 'auth0|existing123';

    mockClient.users.listUsersByEmail.mockResolvedValue([{ user_id: existingUserId }]);
    mockClient.users.update.mockResolvedValue({});

    const userId = await service.createBlockedUser(email);

    expect(userId).toBe(existingUserId);
    expect(mockClient.users.create).not.toHaveBeenCalled();
    expect(mockClient.users.update).toHaveBeenCalledWith(existingUserId, { blocked: true });
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
});
