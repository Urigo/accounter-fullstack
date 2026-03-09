import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type { IInsertAuditLogParams, IInsertAuditLogQuery } from '../types.js';

const insertAuditLog = sql<IInsertAuditLogQuery>`
  INSERT INTO accounter_schema.audit_logs (
          business_id,
          user_id,
          action,
          entity,
          entity_id,
          details
        )
        VALUES ($ownerId, $userId, $action, $entity, $entityId, $details::jsonb);
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AuditLogsProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  public async insertAuditLog(params: IInsertAuditLogParams) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    return insertAuditLog.run(reassureOwnerIdExists(params, ownerId), this.db);
  }
}
