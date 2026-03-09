import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { AuthorizationProvider } from '../../auth/providers/authorization.provider.js';

@Injectable({ scope: Scope.Operation, global: true })
export class ChargesAuthorizationProvider extends AuthorizationProvider {
  constructor(
    authProvider: AuthContextProvider,
    private db: TenantAwareDBClient,
  ) {
    super(authProvider);
  }

  async canReadCharges(): Promise<void> {
    await this.requireAuth();
  }

  async canWriteCharge(): Promise<void> {
    await this.requireRole(['business_owner', 'accountant']);
  }

  async canDeleteCharge(chargeId: string): Promise<void> {
    await this.requireBusinessOwner();

    const { rows } = await this.db.query('SELECT id FROM accounter_schema.charges WHERE id = $1', [
      chargeId,
    ]);

    if (!rows.length) {
      throw new GraphQLError('Charge not found or access denied', {
        extensions: { code: 'NOT_FOUND' },
      });
    }
  }
}
