import { createHash } from 'node:crypto';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { RawAuth } from '../../../plugins/auth-plugin.js';
import { ENVIRONMENT, RAW_AUTH } from '../../../shared/tokens.js';
import type { AuthContext } from '../../../shared/types/auth.js';
import type { Environment } from '../../../shared/types/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import { ALLOWED_API_KEY_ROLES } from '../helpers/api-keys.helper.js';

// Global cache for JWKS functions to prevent re-fetching on every request
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

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

    return null;
  }

  private async handleApiKeyAuth(): Promise<AuthContext | null> {
    const token = this.rawAuth.token;
    if (!token) {
      return null;
    }

    try {
      const context = await this.resolveApiKeyContext(token);
      this.cachedContext = context;
      this.handlingAuth = null;
      return context;
    } catch (error) {
      console.error('AuthContext: Failed to process API key', error);
      this.handlingAuth = null;
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
        accessTokenExpiresAt: payload.exp,
      };
      this.cachedContext = authContext;
      this.handlingAuth = null;
      return authContext;
    } catch (error) {
      console.error('AuthContext: Failed to process authentication token', error);
      this.handlingAuth = null;
      return null;
    }
  }

  private async mapAuth0UserToLocal(
    auth0UserId: string,
    email: string | null,
    emailVerified: boolean,
  ): Promise<{ userId: string; businessId: string; roleId: string } | null> {
    const byAuth0Query = `
      SELECT bu.user_id, bu.business_id, bu.role_id
      FROM accounter_schema.business_users bu
      WHERE bu.auth0_user_id = $1
      LIMIT 1
    `;

    const byVerifiedEmailQuery = `
      SELECT bu.user_id, bu.business_id, bu.role_id
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

    try {
      const byAuth0Result = await this.db.query(byAuth0Query, [auth0UserId]);
      if (byAuth0Result.rowCount && byAuth0Result.rowCount > 0) {
        const row = byAuth0Result.rows[0];
        return {
          userId: row.user_id,
          businessId: row.business_id,
          roleId: row.role_id,
        };
      }

      if (!email || !emailVerified) {
        return null;
      }

      const byEmailResult = await this.db.query(byVerifiedEmailQuery, [email]);
      if (!byEmailResult.rowCount || byEmailResult.rowCount === 0) {
        return null;
      }

      const row = byEmailResult.rows[0];

      // Sync newly authenticated Auth0 subject across all memberships of this local user.
      await this.db.query(relinkAuth0IdQuery, [auth0UserId, row.user_id]);

      return {
        userId: row.user_id,
        businessId: row.business_id,
        roleId: row.role_id,
      };
    } catch (error) {
      console.error('AuthContext: DB lookup failed', error);
      throw error;
    }
  }
}
