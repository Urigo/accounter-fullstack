import { ManagementClient } from 'auth0';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { ENVIRONMENT } from '../../../shared/tokens.js';
import type { Environment } from '../../../shared/types/index.js';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class Auth0ManagementProvider {
  private client: ManagementClient | undefined;

  // Short-lived cache of Auth0 profile lookups. The provider is a Singleton, so
  // this is shared across requests to avoid hammering the Auth0 Management API
  // (and its rate limits) when listing users. The TTL bounds staleness so
  // profile changes in Auth0 still propagate within a few minutes.
  private profileCache = new Map<
    string,
    { profile: { email: string | null; name: string | null }; expiresAt: number }
  >();
  private readonly PROFILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(@Inject(ENVIRONMENT) private env: Environment) {
    this.initializeClient();
  }

  private initializeClient() {
    if (this.env.auth0) {
      this.client = new ManagementClient({
        domain: this.env.auth0.domain,
        clientId: this.env.auth0.clientId,
        clientSecret: this.env.auth0.clientSecret,
        audience: this.env.auth0.managementAudience,
      });
    } else {
      console.warn('Auth0 not configured, Auth0ManagementProvider disabled');
    }
  }

  private getClient(): ManagementClient {
    if (!this.client) {
      throw new Error('Auth0 client not initialized');
    }
    return this.client;
  }

  async getUserByEmail(email: string): Promise<string | null> {
    const client = this.getClient();
    try {
      const users = await client.users.listUsersByEmail({ email });
      if (users?.length > 0) {
        return users[0].user_id ?? null;
      }
      return null;
    } catch (error) {
      console.error(`Failed to get Auth0 user by email ${email}:`, error);
      throw new Error(`Failed to get Auth0 user by email: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async getUserEmailById(
    auth0UserId: string,
  ): Promise<{ email: string | null; emailVerified: boolean } | null> {
    const client = this.getClient();

    try {
      const user = await client.users.get(auth0UserId);
      return {
        email: typeof user?.email === 'string' ? user.email : null,
        emailVerified: user?.email_verified === true,
      };
    } catch (error) {
      console.error(`Failed to get Auth0 user by id ${auth0UserId}:`, error);
      return null;
    }
  }

  /**
   * Fetch the display identity (email + name) for an Auth0 user.
   * Returns null when the lookup fails so callers can degrade gracefully
   * instead of failing the whole request.
   */
  async getUserProfileById(
    auth0UserId: string,
  ): Promise<{ email: string | null; name: string | null } | null> {
    const cached = this.profileCache.get(auth0UserId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.profile;
    }

    const client = this.getClient();

    try {
      const user = await client.users.get(auth0UserId);
      const profile = {
        email: typeof user?.email === 'string' ? user.email : null,
        name: typeof user?.name === 'string' ? user.name : null,
      };
      // Only successful lookups are cached, so transient failures are retried.
      this.profileCache.set(auth0UserId, {
        profile,
        expiresAt: Date.now() + this.PROFILE_CACHE_TTL_MS,
      });
      return profile;
    } catch (error) {
      console.error(`Failed to get Auth0 user profile by id ${auth0UserId}:`, error);
      return null;
    }
  }

  async createBlockedUser(email: string, password?: string): Promise<string> {
    const client = this.getClient();

    const existingUserId = await this.getUserByEmail(email);
    if (existingUserId) {
      return existingUserId;
    }

    const temporaryPassword = password || this.generateTemporaryPassword();

    try {
      const user = await client.users.create({
        connection: 'Username-Password-Authentication',
        email,
        password: temporaryPassword,
        email_verified: false,
        blocked: true,
        app_metadata: {
          registered_by: 'accounter',
        },
      });

      if (!user.user_id) {
        throw new Error('Auth0 did not return a user ID');
      }

      return user.user_id;
    } catch (error) {
      console.error('Failed to create Auth0 user:', error);
      throw new Error(`Failed to create Auth0 user: ${(error as Error).message}`, { cause: error });
    }
  }

  async unblockUser(auth0UserId: string): Promise<void> {
    const client = this.getClient();
    try {
      await client.users.update(auth0UserId, { blocked: false });
    } catch (error) {
      console.error(`Failed to unblock Auth0 user ${auth0UserId}:`, error);
      throw new Error(`Failed to unblock Auth0 user: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }
  async blockUser(auth0UserId: string): Promise<void> {
    const client = this.getClient();
    try {
      await client.users.update(auth0UserId, { blocked: true });
    } catch (error) {
      console.error(`Failed to block Auth0 user ${auth0UserId}:`, error);
      throw new Error(`Failed to block Auth0 user: ${(error as Error).message}`, { cause: error });
    }
  }
  async deleteUser(auth0UserId: string): Promise<void> {
    const client = this.getClient();
    try {
      // Cleanup for expired invitations
      await client.users.delete(auth0UserId);
    } catch (error) {
      console.error(`Failed to delete Auth0 user ${auth0UserId}:`, error);
      throw new Error(`Failed to delete Auth0 user: ${(error as Error).message}`, { cause: error });
    }
  }

  async sendPasswordResetEmail(auth0UserId: string): Promise<string> {
    const client = this.getClient();
    try {
      const { ticket } = await client.tickets.changePassword({
        user_id: auth0UserId,
        mark_email_as_verified: true, // Mark verified only after password change
        result_url: this.env.general.frontendUrl
          ? `${this.env.general.frontendUrl}/login`
          : undefined,
      });
      return ticket;
    } catch (error) {
      console.error('Failed to trigger password change', error);
      throw new Error(`Failed to trigger password change: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  private generateTemporaryPassword(): string {
    // Generate a random password that meets strict Auth0 requirements:
    // 8+ chars, lower, upper, number, special char
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+~`|}{[]\\:;?><,./-=';
    const all = lower + upper + numbers + special;

    const pick = (str: string) => {
      const randomValues = new Uint32Array(1);
      globalThis.crypto.getRandomValues(randomValues);
      return str[randomValues[0] % str.length];
    };

    const password =
      pick(lower) +
      pick(upper) +
      pick(numbers) +
      pick(special) +
      Array.from({ length: 12 }, () => pick(all)).join('');

    return password;
  }
}
