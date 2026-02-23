import { ManagementClient } from 'auth0';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Auth0ManagementService } from '../auth0-management.service.js';

// Mock auth0 library
vi.mock('auth0', () => {
  const users = {
    create: vi.fn(),
    delete: vi.fn(),
  };
  const ManagementClient = vi.fn(function() {
    return {
        users,
    }
});
  return { ManagementClient };
});

// Mock environment
vi.mock('../../../../environment.js', () => ({
  env: {
    auth0: {
      domain: 'test-domain',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      managementAudience: 'test-audience',
    },
  },
}));

describe('Auth0ManagementService', () => {
  let service: Auth0ManagementService;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new Auth0ManagementService();
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
      audience: 'test-audience',
    });
  });

  it('should create a blocked user with temporary password', async () => {
    const email = 'test@example.com';
    const mockUserId = 'auth0|123456';
    
    mockClient.users.create.mockResolvedValue({
      data: {
        user_id: mockUserId,
      },
    });

    const userId = await service.createUser(email);

    expect(userId).toBe(mockUserId);
    expect(mockClient.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        connection: 'Username-Password-Authentication',
        email,
        blocked: true,
        email_verified: false,
        app_metadata: {
            registrated_by: 'accounter',
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

  it('should delete a user', async () => {
    const userId = 'auth0|123456';
    
    mockClient.users.delete.mockResolvedValue({});

    await service.deleteUser(userId);

    expect(mockClient.users.delete).toHaveBeenCalledWith(userId);
  });

  it('should throw error if creation fails', async () => {
    mockClient.users.create.mockRejectedValue(new Error('Auth0 Error'));

    await expect(service.createUser('fail@test.com')).rejects.toThrow('Failed to create Auth0 user: Auth0 Error');
  });
});
