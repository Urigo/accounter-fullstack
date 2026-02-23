import { ManagementClient } from 'auth0';
import { Injectable, Scope } from 'graphql-modules';
import { env } from '../../../environment.js';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class Auth0ManagementService {
  private client: ManagementClient | undefined;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    if (env.auth0) {
      this.client = new ManagementClient({
        domain: env.auth0.domain,
        clientId: env.auth0.clientId,
        clientSecret: env.auth0.clientSecret,
        audience: env.auth0.managementAudience,
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

  async createUser(email: string): Promise<string> {
    const client = this.getClient();
    const temporaryPassword = this.generateTemporaryPassword();

    try {
      const user = await client.users.create({
        connection: 'Username-Password-Authentication',
        email,
        password: temporaryPassword,
        email_verified: false,
        blocked: true,
        app_metadata: {
          registrated_by: 'accounter',
        },
      });

      return user.data.user_id;
    } catch (error) {
      console.error('Failed to create Auth0 user:', error);
      throw new Error(`Failed to create Auth0 user: ${(error as Error).message}`);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const client = this.getClient();
    try {
      await client.users.delete(userId);
    } catch (error) {
      console.error(`Failed to delete Auth0 user ${userId}:`, error);
      throw new Error(`Failed to delete Auth0 user: ${(error as Error).message}`);
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
