import { createHash } from 'node:crypto';
import { GraphQLError } from 'graphql';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { RawAuth } from '../../../plugins/auth-plugin.js';
import { narrowReadScope, readScopeFromMemberships } from '../../../shared/helpers/auth-scope.js';
import { ENVIRONMENT, RAW_AUTH } from '../../../shared/tokens.js';
import type { AuthContext, BusinessMembership } from '../../../shared/types/auth.js';
import type { Environment } from '../../../shared/types/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import { ALLOWED_API_KEY_ROLES } from '../helpers/api-keys.helper.js';

// Global cache for JWKS functions to prevent re-fetching on every request
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

type QueryableDB = Pick<DBProvider, 'query'>;

export async function handleDevBypassAuth(
  db: QueryableDB,
  userId: string,
): Promise<AuthContext | null> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return null;
  }

  // Resolve ALL memberships for the user (previously LIMIT 1). The primary
  // membership (most recently updated) still backs the single-business tenant
  // context for now; scope rules are applied in a later step.
  const { rows } = await db.query<{
    user_id: string;
    business_id: string;
    role_id: string;
    auth0_user_id: string | null;
  }>(
    `SELECT user_id, business_id, role_id, auth0_user_id
     FROM accounter_schema.business_users
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [normalizedUserId],
  );

  if (!rows.length) {
    return null;
  }

  const primary = rows[0];
  const memberships: BusinessMembership[] = rows.map(row => ({
    businessId: row.business_id,
    roleId: row.role_id,
  }));

  return {
    authType: 'devBypass',
    token: normalizedUserId,
    user: {
      userId: primary.user_id,
      auth0UserId: primary.auth0_user_id,
      email: 'dev-user',
      roleId: primary.role_id,
      permissions: [],
      emailVerified: true,
      permissionsVersion: 0,
    },
    tenant: {
      businessId: primary.business_id,
      roleId: primary.role_id,
    },
    memberships,
    // Default read scope is every accessible business; the provider narrows it
    // when a valid X-Business-Scope header is requested.
    activeReadScope: readScopeFromMemberships(memberships),
  };
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AuthContextProvider {
  private cachedContext: AuthContext | null | undefined = undefined;
  private handlingAuth: Promise<AuthContext | null> | null = null;

  constructor(
    @Inject(ENVIRONMENT) private env: Environment,
    @Inject(RAW_AUTH) private rawAuth: RawAuth,
    @Inject(DBProvider) private db: DBProvider,
  ) {}

  public async getJwtIdentity(): Promise<{
    auth0UserId: string;
    email: string | null;
    emailVerified: boolean;
  } | null> {
    const token = this.rawAuth.token;
    if (this.rawAuth.authType !== 'jwt' || !token) {
      return null;
    }

    try {
      if (!this.env.auth0) {
        return null;
      }

      const domain = this.env.auth0.domain;
      let JWKS = jwksCache.get(domain);

      if (!JWKS) {
        JWKS = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
        jwksCache.set(domain, JWKS);
      }

      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `https://${domain}/`,
        audience: this.env.auth0.audience,
      });

      const auth0UserId = payload.sub;
      if (!auth0UserId) {
        return null;
      }

      const jwtEmailClaim = payload['email'];
      const jwtEmailVerifiedClaim = payload['email_verified'];

      return {
        auth0UserId,
        email: typeof jwtEmailClaim === 'string' ? jwtEmailClaim : null,
        emailVerified: jwtEmailVerifiedClaim === true,
      };
    } catch {
      return null;
    }
  }

  public async getAuthContext(): Promise<AuthContext | null> {
    if (this.cachedContext !== undefined) {
      return this.cachedContext;
    }

    if (!this.rawAuth.authType) {
      return null;
    }

    if (this.handlingAuth) {
      return this.handlingAuth;
    }

    if (this.rawAuth.authType === 'jwt') {
      this.handlingAuth = this.handleJwtAuth();
      return this.handlingAuth;
    }

    if (this.rawAuth.authType === 'apiKey') {
      this.handlingAuth = this.handleApiKeyAuth();
      return this.handlingAuth;
    }

    if (this.rawAuth.authType === 'devBypass') {
      this.handlingAuth = this.handleDevBypassAuth();
      return this.handlingAuth;
    }

    return null;
  }

  /**
   * Resolve the request's read scope and attach it to the context.
   *
   * - Defaults to every business the user belongs to.
   * - When a valid `X-Business-Scope` header is present, narrows to that subset;
   *   rejects (returns null) if it requests a business outside the memberships
   *   or if the header was malformed.
   * - API keys are pinned to their single business and ignore the header.
   */
  private applyRequestedReadScope(context: AuthContext): AuthContext {
    const memberships = context.memberships ?? [];
    const defaultScope = readScopeFromMemberships(memberships);

    if (context.authType === 'apiKey') {
      return { ...context, activeReadScope: defaultScope };
    }

    const requested = this.rawAuth.requestedBusinessScope;
    if (!requested || requested.kind === 'absent') {
      return { ...context, activeReadScope: defaultScope };
    }

    if (requested.kind === 'invalid') {
      console.warn('AuthContext: rejecting request with malformed X-Business-Scope header', {
        errors: requested.errors,
        userId: context.user?.userId,
      });
      throw new GraphQLError('X-Business-Scope header is malformed', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const narrowed = narrowReadScope(memberships, requested.businessIds);
    if (!narrowed) {
      console.warn('AuthContext: rejecting X-Business-Scope outside of user memberships', {
        requested: requested.businessIds,
        allowed: memberships.map(m => m.businessId),
        userId: context.user?.userId,
      });
      throw new GraphQLError('X-Business-Scope contains businesses outside your membership', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return { ...context, activeReadScope: narrowed };
  }

  private async handleDevBypassAuth(): Promise<AuthContext | null> {
    const userId = this.rawAuth.token;
    if (!userId) {
      return null;
    }

    try {
      const context = await handleDevBypassAuth(this.db, userId);
      const scoped = context ? this.applyRequestedReadScope(context) : null;
      this.cachedContext = scoped;
      this.handlingAuth = null;
      return scoped;
    } catch (error) {
      this.handlingAuth = null;
      if (error instanceof GraphQLError) {
        throw error;
      }
      console.error('AuthContext: Failed to process dev bypass auth', error);
      return null;
    }
  }

  private async handleApiKeyAuth(): Promise<AuthContext | null> {
    const token = this.rawAuth.token;
    if (!token) {
      return null;
    }

    try {
      const context = await this.resolveApiKeyContext(token);
      const scoped = context ? this.applyRequestedReadScope(context) : null;
      this.cachedContext = scoped;
      this.handlingAuth = null;
      return scoped;
    } catch (error) {
      this.handlingAuth = null;
      if (error instanceof GraphQLError) {
        throw error;
      }
      console.error('AuthContext: Failed to process API key', error);
      return null;
    }
  }

  private async resolveApiKeyContext(plaintextKey: string): Promise<AuthContext | null> {
    const keyHash = createHash('sha256').update(plaintextKey).digest('hex');

    const { rows } = await this.db.query<{
      id: string;
      business_id: string;
      role_id: string;
    }>(
      `SELECT id, business_id, role_id
       FROM accounter_schema.api_keys
       WHERE key_hash = $1
         AND revoked_at IS NULL`,
      [keyHash],
    );

    if (!rows.length) {
      return null;
    }

    const apiKey = rows[0];

    if (!ALLOWED_API_KEY_ROLES.includes(apiKey.role_id as (typeof ALLOWED_API_KEY_ROLES)[number])) {
      console.warn(`AuthContext: API key has disallowed role '${apiKey.role_id}', rejecting`);
      return null;
    }

    // Reduce write amplification by touching usage timestamp at most once per hour.
    await this.db.query(
      `UPDATE accounter_schema.api_keys
       SET last_used_at = NOW()
       WHERE id = $1
         AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '1 hour')`,
      [apiKey.id],
    );

    return {
      authType: 'apiKey',
      token: plaintextKey,
      tenant: {
        businessId: apiKey.business_id,
      },
      user: {
        userId: `api-key:${apiKey.id}`,
        auth0UserId: null,
        email: '',
        roleId: apiKey.role_id,
        permissions: [],
        emailVerified: true,
        permissionsVersion: 0,
      },
      // API keys are pinned to a single business, so the membership set is
      // exactly that one business.
      memberships: [{ businessId: apiKey.business_id, roleId: apiKey.role_id }],
    };
  }

  private async handleJwtAuth(): Promise<AuthContext | null> {
    const token = this.rawAuth.token;
    if (!token) {
      return null;
    }

    try {
      if (!this.env.auth0) {
        throw new Error('Auth0 configuration is missing');
      }

      // 1. Verify JWT signature using Auth0 JWKS
      const domain = this.env.auth0.domain;
      let JWKS = jwksCache.get(domain);

      if (!JWKS) {
        JWKS = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
        jwksCache.set(domain, JWKS);
      }

      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `https://${domain}/`,
        audience: this.env.auth0.audience,
      });

      // 2. Extract Auth0 user ID
      const auth0UserId = payload.sub;

      if (!auth0UserId) {
        console.error('AuthContext: Missing sub claim in JWT');
        this.handlingAuth = null;
        this.cachedContext = null;
        return null;
      }

      const jwtEmailClaim = payload['email'];
      const jwtEmailVerifiedClaim = payload['email_verified'];
      const jwtEmail = typeof jwtEmailClaim === 'string' ? jwtEmailClaim : null;
      const jwtEmailVerified = jwtEmailVerifiedClaim === true;

      // 3. Map to local user and business (with verified-email fallback relinking).
      const userContext = await this.mapAuth0UserToLocal(auth0UserId, jwtEmail, jwtEmailVerified);

      if (!userContext) {
        console.warn(`AuthContext: User not found/linked in local DB: ${auth0UserId}`);
        this.handlingAuth = null;
        this.cachedContext = null;
        return null;
      }

      // 4. Construct AuthContext
      const authContext: AuthContext = {
        authType: 'jwt', // Will be treated as AuthType
        token,
        user: {
          userId: userContext.userId,
          roleId: userContext.roleId,
          email: jwtEmail ?? '',
          auth0UserId,
          permissions: (payload['permissions'] as string[]) ?? [],
          emailVerified: jwtEmailVerified,
          permissionsVersion: 0,
        },
        tenant: {
          businessId: userContext.businessId,
          roleId: userContext.roleId,
        },
        memberships: userContext.memberships,
        accessTokenExpiresAt: payload.exp,
      };
      const scoped = this.applyRequestedReadScope(authContext);
      this.cachedContext = scoped;
      this.handlingAuth = null;
      return scoped;
    } catch (error) {
      this.handlingAuth = null;
      if (error instanceof GraphQLError) {
        throw error;
      }
      console.error('AuthContext: Failed to process authentication token', error);
      return null;
    }
  }

  private async mapAuth0UserToLocal(
    auth0UserId: string,
    email: string | null,
    emailVerified: boolean,
  ): Promise<{
    userId: string;
    businessId: string;
    roleId: string;
    memberships: BusinessMembership[];
  } | null> {
    // Resolve ALL memberships for the auth0 subject (previously LIMIT 1).
    const byAuth0Query = `
      SELECT bu.user_id, bu.business_id, bu.role_id
      FROM accounter_schema.business_users bu
      WHERE bu.auth0_user_id = $1
      ORDER BY bu.updated_at DESC
    `;

    // Identify the local user by a verified, accepted invitation email.
    const byVerifiedEmailQuery = `
      SELECT bu.user_id
      FROM accounter_schema.invitations i
      JOIN accounter_schema.business_users bu
        ON bu.user_id = i.user_id
       AND bu.business_id = i.business_id
      WHERE LOWER(i.email) = LOWER($1)
        AND i.accepted_at IS NOT NULL
      ORDER BY i.accepted_at DESC
      LIMIT 1
    `;

    const relinkAuth0IdQuery = `
      UPDATE accounter_schema.business_users
      SET auth0_user_id = $1, updated_at = NOW()
      WHERE user_id = $2
    `;

    // All memberships for a local user id, after relinking.
    const byUserIdQuery = `
      SELECT bu.user_id, bu.business_id, bu.role_id
      FROM accounter_schema.business_users bu
      WHERE bu.user_id = $1
      ORDER BY bu.updated_at DESC
    `;

    type MembershipRow = { user_id: string; business_id: string; role_id: string };

    const toResult = (rows: MembershipRow[]) => {
      const primary = rows[0];
      const memberships: BusinessMembership[] = rows.map(row => ({
        businessId: row.business_id,
        roleId: row.role_id,
      }));
      return {
        userId: primary.user_id,
        businessId: primary.business_id,
        roleId: primary.role_id,
        memberships,
      };
    };

    try {
      const byAuth0Result = await this.db.query<MembershipRow>(byAuth0Query, [auth0UserId]);
      if (byAuth0Result.rowCount && byAuth0Result.rowCount > 0) {
        return toResult(byAuth0Result.rows);
      }

      if (!email || !emailVerified) {
        return null;
      }

      const byEmailResult = await this.db.query<{ user_id: string }>(byVerifiedEmailQuery, [email]);
      if (!byEmailResult.rowCount || byEmailResult.rowCount === 0) {
        return null;
      }

      const userId = byEmailResult.rows[0].user_id;

      // Sync newly authenticated Auth0 subject across all memberships of this local user.
      await this.db.query(relinkAuth0IdQuery, [auth0UserId, userId]);

      const membershipsResult = await this.db.query<MembershipRow>(byUserIdQuery, [userId]);
      if (!membershipsResult.rowCount || membershipsResult.rowCount === 0) {
        return null;
      }

      return toResult(membershipsResult.rows);
    } catch (error) {
      console.error('AuthContext: DB lookup failed', error);
      throw error;
    }
  }
}
