import { Inject, Injectable, Scope } from 'graphql-modules';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { RawAuth } from '../../../plugins/auth-plugin-v2.js';
import { ENVIRONMENT, RAW_AUTH } from '../../../shared/tokens.js';
import type { AuthContext } from '../../../shared/types/auth.js';
import type { Environment } from '../../../shared/types/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';

// Global cache for JWKS functions to prevent re-fetching on every request
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

@Injectable({
  scope: Scope.Operation,
})
export class AuthContextV2Provider {
  constructor(
    @Inject(RAW_AUTH) private rawAuth: RawAuth,
    private db: TenantAwareDBClient,
    @Inject(ENVIRONMENT) private env: Environment,
  ) {}

  public async getAuthContext(): Promise<AuthContext | null> {
    if (!this.rawAuth.authType) {
      return null;
    }

    if (this.rawAuth.authType === 'jwt') {
      return this.handleJwtAuth();
    }

    if (this.rawAuth.authType === 'apiKey') {
      // Placeholder for Phase 7
      return null;
    }

    return null;
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
        console.error('AuthContextV2: Missing sub claim in JWT');
        return null;
      }

      // 3. Map to local user and business
      const userContext = await this.mapAuth0UserToLocal(auth0UserId);

      if (!userContext) {
        console.warn(`AuthContextV2: User not found/linked in local DB: ${auth0UserId}`);
        return null;
      }

      return {
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
    } catch (error) {
      console.error('AuthContextV2: JWT verification failed', error);
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
      console.error('AuthContextV2: DB lookup failed', error);
      throw error;
    }
  }
}
