import { createHash } from 'node:crypto';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { RawAuth } from '../../../plugins/auth-plugin.js';
import { ENVIRONMENT, RAW_AUTH } from '../../../shared/tokens.js';
import type { AuthContext } from '../../../shared/types/auth.js';
import type { Environment } from '../../../shared/types/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import { ALLOWED_API_KEY_ROLES } from './api-keys.provider.js';

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

      // 3. Map to local user and business
      const userContext = await this.mapAuth0UserToLocal(auth0UserId);

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
          email: (payload.email as string) ?? '',
          auth0UserId,
          permissions: (payload.permissions as string[]) ?? [],
          emailVerified: (payload.email_verified as boolean) ?? false,
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
  ): Promise<{ userId: string; businessId: string; roleId: string } | null> {
    const query = `
      SELECT bu.user_id, bu.business_id, bu.role_id
      FROM accounter_schema.business_users bu
      WHERE bu.auth0_user_id = $1
      LIMIT 1
    `;

    try {
      const result = await this.db.query(query, [auth0UserId]);
      if (result.rowCount === 0) {
        return null;
      }
      const row = result.rows[0];
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
