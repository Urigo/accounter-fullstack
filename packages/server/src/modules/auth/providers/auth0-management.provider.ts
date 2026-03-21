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
      throw new Error(`Failed to get Auth0 user by email: ${(error as Error).message}`);
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

  async createBlockedUser(email: string, password?: string): Promise<string> {
    const client = this.getClient();

    // Reuse existing Auth0 user if one already exists for this email.
    const existingId = await this.getUserByEmail(email);
    if (existingId) {
      // Ensure the existing account is blocked so they cannot log in until invitation is accepted.
      await client.users.update(existingId, { blocked: true }).catch(err => {
        console.warn(`Could not re-block existing Auth0 user ${existingId}:`, err);
      });
      return existingId;
    }

    const temporaryPassword = password || this.generateTemporaryPassword();

    try {
      // Create user with blocked status (prevents login until invitation accepted)
      const user = await client.users.create({
        connection: 'Username-Password-Authentication',
        email,
        password: temporaryPassword, // User will reset via invitation
        email_verified: false,
        blocked: true,
        app_metadata: {
          registered_by: 'accounter',
        },
      });

      if (!user.user_id) {
        throw new Error('Auth0 did not return a user ID');
      }

      // Returns Auth0 user ID (e.g., "auth0|507f...")
      return user.user_id;
    } catch (error) {
      console.error('Failed to create Auth0 user:', error);
      throw new Error(`Failed to create Auth0 user: ${(error as Error).message}`);
    }
  }

  async unblockUser(auth0UserId: string): Promise<void> {
    const client = this.getClient();
    try {
      await client.users.update(auth0UserId, { blocked: false });
    } catch (error) {
      console.error(`Failed to unblock Auth0 user ${auth0UserId}:`, error);
      throw new Error(`Failed to unblock Auth0 user: ${(error as Error).message}`);
    }
  }
  async blockUser(auth0UserId: string): Promise<void> {
    const client = this.getClient();
    try {
      await client.users.update(auth0UserId, { blocked: true });
    } catch (error) {
      console.error(`Failed to block Auth0 user ${auth0UserId}:`, error);
      throw new Error(`Failed to block Auth0 user: ${(error as Error).message}`);
    }
  }
  async deleteUser(auth0UserId: string): Promise<void> {
    const client = this.getClient();
    try {
      // Cleanup for expired invitations
      await client.users.delete(auth0UserId);
    } catch (error) {
      console.error(`Failed to delete Auth0 user ${auth0UserId}:`, error);
      throw new Error(`Failed to delete Auth0 user: ${(error as Error).message}`);
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
      throw new Error(`Failed to trigger password change: ${(error as Error).message}`);
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
