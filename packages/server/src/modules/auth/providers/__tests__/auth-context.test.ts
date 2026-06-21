import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as jose from 'jose';
import { GraphQLError } from 'graphql';
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
         memberships: [{ businessId: 'b-1', roleId: 'admin' }],
         activeReadScope: { businessIds: ['b-1'] },
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
          // byAuth0: no rows for the new subject
          .mockResolvedValueOnce({ rowCount: 0, rows: [] })
          // byVerifiedEmail: identifies the local user
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ user_id: 'u-42' }],
          })
          // relink UPDATE
          .mockResolvedValueOnce({ rowCount: 2, rows: [] })
          // byUserId: ALL memberships for the relinked user
          .mockResolvedValueOnce({
            rowCount: 2,
            rows: [
              { user_id: 'u-42', business_id: 'b-42', role_id: 'employee' },
              { user_id: 'u-42', business_id: 'b-99', role_id: 'accountant' },
            ],
          });

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
        expect(mockDBProvider.query).toHaveBeenNthCalledWith(
          4,
          expect.stringContaining('WHERE bu.user_id = $1'),
          ['u-42'],
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
          memberships: [
            { businessId: 'b-42', roleId: 'employee' },
            { businessId: 'b-99', roleId: 'accountant' },
          ],
          activeReadScope: { businessIds: ['b-42', 'b-99'] },
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

describe('AuthContextProvider read-scope resolution', () => {
  const makeJwtProvider = (
    membershipRows: Array<{ user_id: string; business_id: string; role_id: string }>,
    requestedBusinessScope?: unknown,
  ) => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rowCount: membershipRows.length, rows: membershipRows }),
    } as any;
    const mockEnv = { auth0: { domain: 'test.auth0.com', audience: 'aud' } } as any;
    vi.mocked(jose.createRemoteJWKSet).mockReturnValue({} as any);
    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload: { sub: 'auth0|x', exp: 1, email: null, email_verified: false, permissions: [] },
    } as any);
    return new AuthContextProvider(
      mockEnv,
      { authType: 'jwt', token: 'valid-token', requestedBusinessScope } as any,
      mockDb,
    );
  };

  const membershipRows = [
    { user_id: 'u-1', business_id: 'b-1', role_id: 'owner' },
    { user_id: 'u-1', business_id: 'b-2', role_id: 'accountant' },
  ];

  it('defaults read scope to all memberships when no header is sent', async () => {
    const result = await makeJwtProvider(membershipRows).getAuthContext();
    expect(result?.activeReadScope).toEqual({ businessIds: ['b-1', 'b-2'] });
  });

  it('narrows read scope to a valid requested subset and re-points the tenant', async () => {
    const result = await makeJwtProvider(membershipRows, {
      kind: 'valid',
      businessIds: ['b-2'],
    }).getAuthContext();
    expect(result?.activeReadScope).toEqual({ businessIds: ['b-2'] });
    // tenant re-points to the scoped business so consumers reading
    // tenant.businessId directly do not operate on the out-of-scope primary
    expect(result?.tenant.businessId).toBe('b-2');
    expect(result?.tenant.roleId).toBe('accountant');
  });

  it('keeps the primary tenant when it remains within a multi-business scope', async () => {
    const result = await makeJwtProvider(membershipRows, {
      kind: 'valid',
      businessIds: ['b-2', 'b-1'],
    }).getAuthContext();
    expect(result?.activeReadScope).toEqual({ businessIds: ['b-2', 'b-1'] });
    // primary (b-1) is still in scope, so the tenant is unchanged
    expect(result?.tenant.businessId).toBe('b-1');
    expect(result?.tenant.roleId).toBe('owner');
  });

  it('re-points to the first scoped business when the primary is outside a multi-business scope', async () => {
    const rows = [
      { user_id: 'u-1', business_id: 'b-1', role_id: 'owner' },
      { user_id: 'u-1', business_id: 'b-2', role_id: 'accountant' },
      { user_id: 'u-1', business_id: 'b-3', role_id: 'employee' },
    ];
    const result = await makeJwtProvider(rows, {
      kind: 'valid',
      businessIds: ['b-2', 'b-3'],
    }).getAuthContext();
    expect(result?.activeReadScope).toEqual({ businessIds: ['b-2', 'b-3'] });
    // primary (b-1) is out of scope → first scoped business becomes the tenant
    expect(result?.tenant.businessId).toBe('b-2');
    expect(result?.tenant.roleId).toBe('accountant');
  });

  it('rejects a requested scope outside the user memberships', async () => {
    await expect(
      makeJwtProvider(membershipRows, {
        kind: 'valid',
        businessIds: ['b-1', 'b-999'],
      }).getAuthContext(),
    ).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
  });

  it('rejects a malformed scope header', async () => {
    await expect(
      makeJwtProvider(membershipRows, {
        kind: 'invalid',
        errors: [{ code: 'INVALID_UUID', value: 'nope' }],
      }).getAuthContext(),
    ).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
  });

  it('does not expand scope beyond memberships (no super-admin auto-expansion)', async () => {
    const result = await makeJwtProvider([
      { user_id: 'u-1', business_id: 'b-1', role_id: 'owner' },
    ]).getAuthContext();
    expect(result?.activeReadScope).toEqual({ businessIds: ['b-1'] });
  });

  it('pins API-key scope to its business and ignores the header', async () => {
    const mockDb = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: 'k1', business_id: 'biz-1', role_id: 'scraper' }],
        })
        .mockResolvedValueOnce({ rowCount: 1 }),
    } as any;
    const provider = new AuthContextProvider(
      { auth0: { domain: 'd', audience: 'a' } } as any,
      {
        authType: 'apiKey',
        token: 'key',
        requestedBusinessScope: { kind: 'valid', businessIds: ['biz-2'] },
      } as any,
      mockDb,
    );

    const result = await provider.getAuthContext();

    expect(result?.tenant.businessId).toBe('biz-1');
    expect(result?.activeReadScope).toEqual({ businessIds: ['biz-1'] });
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
      memberships: [{ businessId: 'biz-456', roleId: 'business_owner' }],
      activeReadScope: { businessIds: ['biz-456'] },
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

  // dev-bypass now resolves ALL memberships (no LIMIT 1); the primary (most
  // recently updated) membership still backs the single-business tenant context.
  it('resolves all memberships and selects the primary as tenant', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { user_id: 'user-1', business_id: 'biz-1', role_id: 'business_owner', auth0_user_id: null },
        { user_id: 'user-1', business_id: 'biz-2', role_id: 'accountant', auth0_user_id: null },
      ],
    });
    const db = { query } as unknown as Pick<DBProvider, 'query'>;

    const result = await handleDevBypassAuth(db, 'user-1');

    expect(query).toHaveBeenCalledWith(expect.not.stringContaining('LIMIT 1'), ['user-1']);
    expect(result?.tenant.businessId).toBe('biz-1');
    expect(result?.memberships).toEqual([
      { businessId: 'biz-1', roleId: 'business_owner' },
      { businessId: 'biz-2', roleId: 'accountant' },
    ]);
  });
});

// JWT auth now resolves all of a user's memberships (no LIMIT 1 on the auth0
// lookup); the primary membership still backs the single-business tenant context.
describe('AuthContextProvider membership resolution', () => {
  it('resolves all memberships for the Auth0 subject without a LIMIT 1 lookup', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rowCount: 2,
        rows: [
          { user_id: 'u-1', business_id: 'b-1', role_id: 'admin' },
          { user_id: 'u-1', business_id: 'b-2', role_id: 'accountant' },
        ],
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
      expect.not.stringContaining('LIMIT 1'),
      ['auth0|123'],
    );
    expect(result?.tenant.businessId).toBe('b-1');
    expect(result?.memberships).toEqual([
      { businessId: 'b-1', roleId: 'admin' },
      { businessId: 'b-2', roleId: 'accountant' },
    ]);
  });
});
