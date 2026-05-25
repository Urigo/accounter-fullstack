import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as jose from 'jose';
import { AuthContextProvider, handleDevBypassAuth } from '../auth-context.provider.js';
import type { DBProvider } from '../../../app-providers/db.provider.js';

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

describe('handleDevBypassAuth', () => {
  it('returns devBypass auth context when user exists', async () => {
    const db = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            user_id: 'user-123',
            business_id: 'biz-456',
            role_id: 'business_owner',
            auth0_user_id: 'auth0|demo',
          },
        ],
      }),
    } as unknown as Pick<DBProvider, 'query'>;

    const result = await handleDevBypassAuth(db, 'user-123');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM accounter_schema.business_users'),
      ['user-123'],
    );
    expect(result).toEqual({
      authType: 'devBypass',
      token: 'user-123',
      user: {
        userId: 'user-123',
        auth0UserId: 'auth0|demo',
        email: 'dev-user',
        roleId: 'business_owner',
        permissions: [],
        emailVerified: true,
        permissionsVersion: 0,
      },
      tenant: {
        businessId: 'biz-456',
        roleId: 'business_owner',
      },
    });
  });

  it('returns null when user is not found', async () => {
    const db = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pick<DBProvider, 'query'>;

    const result = await handleDevBypassAuth(db, 'missing-user');

    expect(result).toBeNull();
  });

  it('returns null for an empty/whitespace user id without querying', async () => {
    const db = {
      query: vi.fn(),
    } as unknown as Pick<DBProvider, 'query'>;

    expect(await handleDevBypassAuth(db, '   ')).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  // Baseline guardrail: dev-bypass collapses a user's memberships to a single
  // business via `ORDER BY updated_at DESC LIMIT 1`. The migration will replace
  // this single-row lookup with full membership resolution.
  it('resolves a single business via LIMIT 1 (single-membership baseline)', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          user_id: 'user-1',
          business_id: 'biz-1',
          role_id: 'business_owner',
          auth0_user_id: null,
        },
      ],
    });
    const db = { query } as unknown as Pick<DBProvider, 'query'>;

    const result = await handleDevBypassAuth(db, 'user-1');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT 1'), ['user-1']);
    expect(result?.tenant.businessId).toBe('biz-1');
    expect(Array.isArray(result?.tenant.businessId)).toBe(false);
  });
});

// Baseline guardrail: JWT auth maps an Auth0 subject to a single local business
// via a `LIMIT 1` lookup. The migration will resolve all memberships instead.
describe('AuthContextProvider single-membership baseline', () => {
  it('maps the Auth0 user to one business using a LIMIT 1 query', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rowCount: 1,
        rows: [{ user_id: 'u-1', business_id: 'b-1', role_id: 'admin' }],
      }),
    } as any;
    const mockEnv = { auth0: { domain: 'test.auth0.com', audience: 'aud' } } as any;
    vi.mocked(jose.createRemoteJWKSet).mockReturnValue({} as any);
    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload: { sub: 'auth0|123', exp: 1, email: null, email_verified: false, permissions: [] },
    } as any);

    const provider = new AuthContextProvider(
      mockEnv,
      { authType: 'jwt', token: 'valid-token' } as any,
      mockDb,
    );
    const result = await provider.getAuthContext();

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 1'),
      ['auth0|123'],
    );
    expect(result?.tenant.businessId).toBe('b-1');
    expect(Array.isArray(result?.tenant.businessId)).toBe(false);
  });
});
