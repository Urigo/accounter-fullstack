import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type { IInsertAuditLogQuery } from '../types.js';
import type { AuditEvent } from '../types/audit-events.js';

export const insertAuditLog = sql<IInsertAuditLogQuery>`
  INSERT INTO accounter_schema.audit_logs (
          business_id,
          user_id,
          auth0_user_id,
          action,
          entity,
          entity_id,
          details,
          ip_address
        )
        VALUES ($ownerId, $userId, $auth0UserId, $action, $entity, $entityId, $details::jsonb, $ipAddress);
`;

type QueryExecutor = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
};

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AuditLogsProvider {
  constructor(private db: TenantAwareDBClient) {}

  public async log(event: AuditEvent, executor?: QueryExecutor): Promise<void> {
    const db = executor ?? this.db;
    await insertAuditLog.run(
      {
        ownerId: event.ownerId ?? null,
        userId: event.userId ?? null,
        auth0UserId: event.auth0UserId ?? null,
        action: event.action,
        entity: event.entity ?? null,
        entityId: event.entityId ?? null,
        details: event.details ? JSON.stringify(event.details) : null,
        ipAddress: event.ipAddress ?? null,
      },
      db,
    );
  }

  // Backward-compatibility wrapper while call sites migrate to the typed event API.
  public async insertAuditLog(params: AuditEvent) {
    if (!params.action) {
      throw new Error('Audit action is required');
    }

    return this.log(params);
  }
}
