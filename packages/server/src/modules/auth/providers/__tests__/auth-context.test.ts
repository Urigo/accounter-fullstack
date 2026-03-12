import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as jose from 'jose';
import { AuthContextProvider } from '../auth-context.provider.js';
import type { DBProvider } from '../../../app-providers/db.provider.js';
import type { Environment } from '../../../../shared/types/index.js';

vi.mock('jose', async () => {
    return {
        createRemoteJWKSet: vi.fn(),
        jwtVerify: vi.fn(),
    }
});

describe('AuthContextProvider', () => {
  let provider: AuthContextProvider;
  let mockDBProvider: any;
  let mockEnv: any;
  let mockRawAuth: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDBProvider = {
      query: vi.fn(),
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

    provider = new AuthContextProvider(mockEnv, mockRawAuth, mockDBProvider);
  });

  it('should return null if authType is null', async () => {
    provider = new AuthContextProvider(mockEnv, { authType: null, token: null }, mockDBProvider);
    const result = await provider.getAuthContext();
    expect(result).toBeNull();
  });

  it('should return null for invalid apiKey', async () => {
    provider = new AuthContextProvider(mockEnv, { authType: 'apiKey', token: 'key' }, mockDBProvider);
    mockDBProvider.query.mockResolvedValueOnce({ rows: [] });
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

       mockDBProvider.query.mockResolvedValue({
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
   
        mockDBProvider.query.mockResolvedValue({
          rowCount: 0,
          rows: [],
        });
   
        const result = await provider.getAuthContext();
   
        expect(result).toBeNull();
    });

      it('should relink user by verified email when auth0 sub changes', async () => {
        const mockPayload = {
          sub: 'google-oauth2|new-subject',
          exp: 1234567890,
          email: 'member@example.com',
          email_verified: true,
          permissions: [],
        };

        vi.mocked(jose.jwtVerify).mockResolvedValue({ payload: mockPayload } as any);

        mockDBProvider.query
          .mockResolvedValueOnce({ rowCount: 0, rows: [] })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ user_id: 'u-42', business_id: 'b-42', role_id: 'employee' }],
          })
          .mockResolvedValueOnce({ rowCount: 2, rows: [] });

        const result = await provider.getAuthContext();

        expect(mockDBProvider.query).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining('WHERE bu.auth0_user_id = $1'),
          ['google-oauth2|new-subject'],
        );
        expect(mockDBProvider.query).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining('FROM accounter_schema.invitations i'),
          ['member@example.com'],
        );
        expect(mockDBProvider.query).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining('UPDATE accounter_schema.business_users'),
          ['google-oauth2|new-subject', 'u-42'],
        );

        expect(result).toEqual({
          authType: 'jwt',
          token: 'valid-token',
          user: {
            userId: 'u-42',
            roleId: 'employee',
            email: 'member@example.com',
            auth0UserId: 'google-oauth2|new-subject',
            permissions: [],
            emailVerified: true,
            permissionsVersion: 0,
          },
          tenant: {
            businessId: 'b-42',
            roleId: 'employee',
          },
          accessTokenExpiresAt: 1234567890,
        });
      });

     it('should return null if sub claim is missing', async () => {
        const mockPayload = {}; // No sub
   
        vi.mocked(jose.jwtVerify).mockResolvedValue({ payload: mockPayload } as any);
   
        const result = await provider.getAuthContext();
   
        expect(result).toBeNull();
    });
  });
});
