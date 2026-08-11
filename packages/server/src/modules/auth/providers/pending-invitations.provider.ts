import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '../../app-providers/db.provider.js';

export type PendingInvitation = {
  id: string;
  businessId: string;
  businessName: string | null;
  role: string;
  expiresAt: Date;
};

/**
 * Lists the invitations waiting for a caller who has no membership yet.
 *
 * Deliberately uses the raw pool rather than `TenantAwareDBClient`: the callers
 * this exists for have no tenant at all, so the tenant-scoped client would throw
 * UNAUTHENTICATED. That makes this a privileged read, and the only thing keeping
 * it safe is the email filter — so every entry point must pass an address the
 * identity provider has verified, never one supplied by the client.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class PendingInvitationsProvider {
  constructor(private dbProvider: DBProvider) {}

  public async getPendingInvitationsByVerifiedEmail(
    verifiedEmail: string,
  ): Promise<PendingInvitation[]> {
    const normalizedEmail = verifiedEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      return [];
    }

    const { rows } = await this.dbProvider.query<{
      id: string;
      business_id: string;
      business_name: string | null;
      role_id: string;
      expires_at: Date;
    }>(
      `SELECT i.id, i.business_id, fe.name AS business_name, i.role_id, i.expires_at
       FROM accounter_schema.invitations i
       LEFT JOIN accounter_schema.financial_entities fe
         ON fe.id = i.business_id
       WHERE LOWER(i.email) = $1
         AND i.accepted_at IS NULL
         AND i.expires_at > NOW()
       ORDER BY i.created_at DESC`,
      [normalizedEmail],
    );

    return rows.map(row => ({
      id: row.id,
      businessId: row.business_id,
      businessName: row.business_name,
      role: row.role_id,
      expiresAt: row.expires_at,
    }));
  }
}
