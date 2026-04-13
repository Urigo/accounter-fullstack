import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  AnnualAuditStepStatus,
  AnnualAuditStepStatusResult,
  IGetStepStatusesQuery,
  IUpsertStepStatusQuery,
  SetAnnualAuditStepStatusInput,
} from '../types.js';

const getStepStatuses = sql<IGetStepStatusesQuery>`
  SELECT owner_id, year, step_id, status, notes, updated_at, completed_at
  FROM accounter_schema.annual_audit_step_status
  WHERE owner_id = $ownerId AND year = $year;
`;

const upsertStepStatus = sql<IUpsertStepStatusQuery>`
  INSERT INTO accounter_schema.annual_audit_step_status
    (owner_id, year, step_id, status, notes, completed_at)
  VALUES ($ownerId, $year, $stepId, $status, $notes, CASE WHEN $status = 'COMPLETED' THEN now() ELSE NULL END)
  ON CONFLICT (owner_id, year, step_id) DO UPDATE
    SET status       = EXCLUDED.status,
        notes        = EXCLUDED.notes,
        completed_at = CASE
          WHEN EXCLUDED.status = 'COMPLETED' AND annual_audit_step_status.completed_at IS NULL
            THEN now()
          WHEN EXCLUDED.status != 'COMPLETED'
            THEN NULL
          ELSE annual_audit_step_status.completed_at
        END
  RETURNING owner_id, year, step_id, status, notes, updated_at, completed_at;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AnnualAuditProvider {
  constructor(private db: TenantAwareDBClient) {}

  public async getStepStatuses(
    ownerId: string,
    year: number,
  ): Promise<AnnualAuditStepStatusResult[]> {
    const rows = await getStepStatuses.run({ ownerId, year }, this.db);
    return rows.map(r => ({
      id: `${r.owner_id}:${r.year}:${r.step_id}`,
      ownerId: r.owner_id,
      year: r.year,
      stepId: r.step_id,
      status: r.status as AnnualAuditStepStatus,
      notes: r.notes,
      updatedAt: r.updated_at,
      completedAt: r.completed_at,
    }));
  }

  public async upsertStepStatus(
    input: SetAnnualAuditStepStatusInput,
  ): Promise<AnnualAuditStepStatusResult> {
    const { ownerId, year, stepId, status, notes } = input;

    const [row] = await upsertStepStatus.run(
      { ownerId, year, stepId, status, notes: notes ?? null },
      this.db,
    );

    if (!row) {
      throw new Error(`Failed to upsert annual audit step status for step ${stepId}`);
    }
    return {
      id: `${row.owner_id}:${row.year}:${row.step_id}`,
      ownerId: row.owner_id,
      year: row.year,
      stepId: row.step_id,
      status: row.status as AnnualAuditStepStatus,
      notes: row.notes,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }
}
