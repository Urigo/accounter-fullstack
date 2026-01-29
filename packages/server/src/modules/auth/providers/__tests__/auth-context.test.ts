import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as jose from 'jose';
import { AuthContextV2Provider } from '../auth-context-v2.provider.js';
import type { DBProvider } from '../../../app-providers/db.provider.js';
import type { Environment } from '../../../../shared/types/index.js';

vi.mock('jose', async () => {
    return {
        createRemoteJWKSet: vi.fn(),
        jwtVerify: vi.fn(),
    }
});

describe('AuthContextV2Provider', () => {
  let provider: AuthContextV2Provider;
  let mockDBProvider: any;
  let mockEnv: any;
  let mockRawAuth: any;

  beforeEach(() => {
    mockDBProvider = {
      pool: {
        query: vi.fn(),
      },
    };

    mockEnv = {
      auth0: {
        domain: 'test.auth0.com',
        audience: 'test-audience',
      },
    };

    mockRawAuth = {
        authType: 'jwt',
        token: 'valid-token',
    };

    vi.mocked(jose.createRemoteJWKSet).mockReturnValue({} as any);

    provider = new AuthContextV2Provider(mockRawAuth, mockDBProvider, mockEnv);
  });

  it('should return null if authType is null', async () => {
    provider = new AuthContextV2Provider({ authType: null, token: null }, mockDBProvider, mockEnv);
    const result = await provider.getAuthContext();
    expect(result).toBeNull();
  });

  it('should return null for apiKey (Phase 7 support)', async () => {
    provider = new AuthContextV2Provider({ authType: 'apiKey', token: 'key' }, mockDBProvider, mockEnv);
    const result = await provider.getAuthContext();
    expect(result).toBeNull();
  });

  describe('JWT Verification', () => {
    it('should verify JWT and return context if valid', async () => {
       const mockPayload = {
         sub: 'auth0|123',
         exp: 1234567890,
         email: 'test@example.com',
         email_verified: false,
         permissions: [],
       };

       vi.mocked(jose.jwtVerify).mockResolvedValue({ payload: mockPayload } as any);

       mockDBProvider.pool.query.mockResolvedValue({
         rowCount: 1,
         rows: [{ user_id: 'u-1', business_id: 'b-1', role_id: 'admin' }],
       });

       const result = await provider.getAuthContext();

       expect(jose.createRemoteJWKSet).toHaveBeenCalled();
       expect(jose.jwtVerify).toHaveBeenCalledWith('valid-token', expect.anything(), {
         issuer: 'https://test.auth0.com/',
         audience: 'test-audience',
       });
       expect(result).toEqual({
         authType: 'jwt',
         token: 'valid-token',
         user: {
           userId: 'u-1',
           roleId: 'admin',
           email: 'test@example.com',
           auth0UserId: 'auth0|123',
           permissions: [],
           emailVerified: false,
           permissionsVersion: 0,
         },
         tenant: {
           businessId: 'b-1',
           roleId: 'admin',
         },
         accessTokenExpiresAt: 1234567890,
       });
    });

    it('should return null if JWT verification fails', async () => {
      vi.mocked(jose.jwtVerify).mockRejectedValue(new Error('Invalid token'));

      const result = await provider.getAuthContext();

      expect(result).toBeNull();
    });

    it('should return null if user not found in DB', async () => {
        const mockPayload = {
            sub: 'auth0|123',
        };
   
        vi.mocked(jose.jwtVerify).mockResolvedValue({ payload: mockPayload } as any);
   
        mockDBProvider.pool.query.mockResolvedValue({
          rowCount: 0,
          rows: [],
        });
   
        const result = await provider.getAuthContext();
   
        expect(result).toBeNull();
    });

     it('should return null if sub claim is missing', async () => {
        const mockPayload = {}; // No sub
   
        vi.mocked(jose.jwtVerify).mockResolvedValue({ payload: mockPayload } as any);
   
        const result = await provider.getAuthContext();
   
        expect(result).toBeNull();
    });
  });
});
