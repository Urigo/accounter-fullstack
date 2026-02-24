import { ManagementClient } from 'auth0';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { ENVIRONMENT } from '../../../shared/tokens.js';
import type { Environment } from '../../../shared/types/index.js';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class Auth0ManagementService {
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
      console.warn('Auth0 not configured, Auth0ManagementService disabled');
    }
  }

  private getClient(): ManagementClient {
    if (!this.client) {
      throw new Error('Auth0 client not initialized');
    }
    return this.client;
  }

  async createBlockedUser(email: string): Promise<string> {
    const client = this.getClient();
    const temporaryPassword = this.generateTemporaryPassword();

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

      // Returns Auth0 user ID (e.g., "auth0|507f...")
      return user.data.user_id;
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
      const { data } = await client.tickets.changePassword({
        user_id: auth0UserId,
        mark_email_as_verified: true, // Mark verified only after password change
        result_url: this.env.general.frontendUrl
          ? `${this.env.general.frontendUrl}/login`
          : undefined,
      });
      return data.ticket;
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
