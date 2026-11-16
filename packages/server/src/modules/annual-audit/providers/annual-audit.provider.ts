import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { getTimelessDateYear } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { DynamicReportProvider } from '../../reports/providers/dynamic-report.provider.js';
import {
  assignTemplateSlot,
  resolveTemplateSlots,
  templateSlotsToEvidence,
  type TemplateSlots,
} from '../helpers/template-slots.helper.js';
import type {
  AnnualAuditOpeningBalanceStatusResult,
  AnnualAuditOpeningBalanceUserType,
  AnnualAuditStepStatus,
  AnnualAuditStepStatusResult,
  IGetBalanceChargeQuery,
  IGetStepStatusesQuery,
  IGetStepStatusQuery,
  IRemoveWorkingTemplateQuery,
  IRenameWorkingTemplateQuery,
  IResetStep09ForTemplateQuery,
  IUpsertStep05EvidenceQuery,
  IUpsertStep09StatusQuery,
  IUpsertStepStatusQuery,
  SetAnnualAuditStep09StatusInput,
  SetAnnualAuditStepStatusInput,
  SetAnnualAuditWorkingTemplateInput,
} from '../types.js';

const getStepStatuses = sql<IGetStepStatusesQuery>`
  SELECT owner_id, year, step_id, status, notes, evidence_json, updated_at, completed_at
  FROM accounter_schema.annual_audit_step_status
  WHERE owner_id = $ownerId AND year = $year;
`;

const getStepStatus = sql<IGetStepStatusQuery>`
  SELECT owner_id, year, step_id, status, notes, evidence_json, updated_at, completed_at
  FROM accounter_schema.annual_audit_step_status
  WHERE owner_id = $ownerId AND year = $year AND step_id = $stepId;
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
  RETURNING owner_id, year, step_id, status, notes, evidence_json, updated_at, completed_at;
`;

const upsertStep09Status = sql<IUpsertStep09StatusQuery>`
  INSERT INTO accounter_schema.annual_audit_step_status
    (owner_id, year, step_id, status, notes, evidence_json, completed_at)
  VALUES (
    $ownerId, $year, '9', $status, NULL, $evidenceJson::jsonb,
    CASE WHEN $status = 'COMPLETED' THEN now() ELSE NULL END
  )
  ON CONFLICT (owner_id, year, step_id) DO UPDATE
    SET status        = EXCLUDED.status,
        notes         = EXCLUDED.notes,
        evidence_json = EXCLUDED.evidence_json,
        completed_at  = CASE
          WHEN EXCLUDED.status = 'COMPLETED'
            THEN COALESCE(annual_audit_step_status.completed_at, now())
          ELSE NULL
        END
  RETURNING owner_id, year, step_id, status, notes, evidence_json, updated_at, completed_at;
`;

/**
 * Drops every step 09 evidence key (balanceSheetTemplateName, profitAndLossTemplateName or the
 * legacy lockedTemplateName) that points at the given template, across all years, and moves those
 * rows back to PENDING. Keys pointing at other templates are kept.
 */
const resetStep09ForTemplate = sql<IResetStep09ForTemplateQuery>`
  UPDATE accounter_schema.annual_audit_step_status
  SET status        = 'PENDING',
      evidence_json = (
        SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
        FROM jsonb_each(evidence_json) AS e
        WHERE e.value <> to_jsonb($templateName::text)
      ),
      completed_at  = NULL
  WHERE owner_id = $ownerId
    AND step_id   = '9'
    AND (
      evidence_json->>'lockedTemplateName' = $templateName
      OR evidence_json->>'balanceSheetTemplateName' = $templateName
      OR evidence_json->>'profitAndLossTemplateName' = $templateName
    );
`;

/** Writes step 05 (working templates) evidence; status and notes are left as they are. */
const upsertStep05Evidence = sql<IUpsertStep05EvidenceQuery>`
  INSERT INTO accounter_schema.annual_audit_step_status
    (owner_id, year, step_id, status, evidence_json)
  VALUES ($ownerId, $year, '5', 'PENDING', $evidenceJson::jsonb)
  ON CONFLICT (owner_id, year, step_id) DO UPDATE
    SET evidence_json = EXCLUDED.evidence_json
  RETURNING owner_id, year, step_id, status, notes, evidence_json, updated_at, completed_at;
`;

/** Points step 05 working-template evidence at a renamed template, across all years. */
const renameWorkingTemplate = sql<IRenameWorkingTemplateQuery>`
  UPDATE accounter_schema.annual_audit_step_status
  SET evidence_json = (
    SELECT jsonb_object_agg(
      e.key,
      CASE WHEN e.value = to_jsonb($prevName::text) THEN to_jsonb($newName::text) ELSE e.value END
    )
    FROM jsonb_each(evidence_json) AS e
  )
  WHERE owner_id = $ownerId
    AND step_id   = '5'
    AND (
      evidence_json->>'balanceSheetTemplateName' = $prevName
      OR evidence_json->>'profitAndLossTemplateName' = $prevName
    );
`;

/** Drops step 05 working-template evidence keys that point at a deleted template. */
const removeWorkingTemplate = sql<IRemoveWorkingTemplateQuery>`
  UPDATE accounter_schema.annual_audit_step_status
  SET evidence_json = (
    SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    FROM jsonb_each(evidence_json) AS e
    WHERE e.value <> to_jsonb($templateName::text)
  )
  WHERE owner_id = $ownerId
    AND step_id   = '5'
    AND (
      evidence_json->>'balanceSheetTemplateName' = $templateName
      OR evidence_json->>'profitAndLossTemplateName' = $templateName
    );
`;

const getBalanceCharge = sql<IGetBalanceChargeQuery>`
  WITH ledger_by_charge AS (
    SELECT count(DISTINCT x.id) AS ledger_count,
           array_remove(array_agg(DISTINCT x.financial_entity), NULL::uuid) AS ledger_financial_entities,
           min(x.value_date) AS min_value_date,
           max(x.value_date) AS max_value_date,
           min(x.invoice_date) AS min_invoice_date,
           max(x.invoice_date) AS max_invoice_date,
           x.charge_id
    FROM (
      SELECT lr.charge_id,
             lr.id,
             lr.value_date,
             lr.invoice_date,
             unnest(
               ARRAY[
                 lr.credit_entity1,
                 lr.credit_entity2,
                 lr.debit_entity1,
                 lr.debit_entity2
               ]
             ) AS financial_entity
      FROM accounter_schema.ledger_records lr
      WHERE lr.charge_id IS NOT NULL
      AND lr.owner_id = $ownerId
    ) x
    GROUP BY x.charge_id
  )
  SELECT c.id
  FROM accounter_schema.charges c
  LEFT JOIN ledger_by_charge l ON l.charge_id = c.id
  WHERE c.owner_id = $ownerId
    AND type = 'FINANCIAL'
    AND l.min_value_date <= make_date($year, 12, 31)
    AND l.max_value_date >= make_date($year, 12, 31)
    AND user_description ILIKE '%balance%'`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AnnualAuditProvider {
  constructor(
    private adminContextProvider: AdminContextProvider,
    private dynamicReportProvider: DynamicReportProvider,
    private db: TenantAwareDBClient,
  ) {}

  public async getOpeningBalanceStatus(
    ownerId: string,
    year: number,
  ): Promise<AnnualAuditOpeningBalanceStatusResult> {
    const adminContext = await this.adminContextProvider.getVerifiedAdminContext();
    const { initialAccounterYear, dateEstablished } = adminContext;

    // Guard: missing configuration
    if (initialAccounterYear == null || dateEstablished == null) {
      return {
        id: `${ownerId}:${year}`,
        userType: 'BLOCKED' as AnnualAuditOpeningBalanceUserType,
        balanceChargeId: null,
        derivedStatus: 'BLOCKED',
        errorMessage:
          'Business configuration is incomplete. Please set initialAccounterYear and dateEstablished in Settings > Admin Context.',
      };
    }

    const establishedYear = getTimelessDateYear(dateEstablished);
    const userType = this.classifyUserType(year, initialAccounterYear, establishedYear);

    if (userType === 'ERROR') {
      return {
        id: `${ownerId}:${year}`,
        userType: 'ERROR',
        balanceChargeId: null,
        derivedStatus: 'BLOCKED',
        errorMessage: `Report year ${year} precedes the first year tracked in Accounter (${initialAccounterYear}). Verify the business configuration (initialAccounterYear, dateEstablished) and try again.`,
      };
    }

    if (userType === 'NEW') {
      return {
        id: `${ownerId}:${year}`,
        userType: 'NEW',
        balanceChargeId: null,
        derivedStatus: 'COMPLETED',
      };
    }

    if (userType === 'CONTINUING') {
      // Prior-year data is already in-system; no DB checks needed.
      // derivedStatus is always PENDING — accountant approval is required.
      return {
        id: `${ownerId}:${year}`,
        userType: 'CONTINUING',
        balanceChargeId: null,
        derivedStatus: 'PENDING',
      };
    }

    // MIGRATING: check for balance charge
    const balanceChargeId = await this.checkBalanceChargeExists(ownerId, year - 1);

    const derivedStatus = this.computeMigratingDerivedStatus(balanceChargeId);

    return {
      id: `${ownerId}:${year}`,
      userType,
      balanceChargeId,
      derivedStatus,
    };
  }

  private classifyUserType(
    reportYear: number,
    initialAccounterYear: number,
    establishedYear: number,
  ): AnnualAuditOpeningBalanceUserType {
    if (reportYear < initialAccounterYear) {
      return 'ERROR';
    }
    if (reportYear === initialAccounterYear && establishedYear === initialAccounterYear) {
      return 'NEW';
    }
    if (reportYear === initialAccounterYear && establishedYear < initialAccounterYear) {
      return 'MIGRATING';
    }
    return 'CONTINUING';
  }

  private computeMigratingDerivedStatus(balanceChargeId: string | null): AnnualAuditStepStatus {
    // COMPLETED is never set automatically; accountant approval is required.
    if (balanceChargeId) {
      return 'IN_PROGRESS';
    }
    return 'PENDING';
  }

  private async checkBalanceChargeExists(ownerId: string, year: number): Promise<string | null> {
    const result = await getBalanceCharge.run({ ownerId, year }, this.db);
    return result[0]?.id || null;
  }

  // ─── Persistence: manual step statuses ───────────────────────────────────

  public async getStepStatuses(
    ownerId: string,
    year: number,
  ): Promise<AnnualAuditStepStatusResult[]> {
    const rows = await getStepStatuses.run({ ownerId, year }, this.db);
    return rows.map(r => this.mapStepStatusRow(r));
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
    return this.mapStepStatusRow(row);
  }

  public async setStep09Status(
    input: SetAnnualAuditStep09StatusInput,
  ): Promise<AnnualAuditStepStatusResult> {
    const { ownerId, year, templateName, reportType } = input;

    const [existing] = await getStepStatus.run({ ownerId, year, stepId: '9' }, this.db);
    const prev = resolveTemplateSlots(existing?.evidence_json);
    const next = assignTemplateSlot(prev, templateName, reportType);

    // Unlock templates this year no longer references (best-effort; they may be gone already),
    // and drop them from any other audit year still pointing at them.
    const stillUsed = new Set([next.balanceSheet, next.profitAndLoss]);
    const released = new Set(
      [prev.balanceSheet, prev.profitAndLoss].filter(
        (name): name is string => !!name && !stillUsed.has(name),
      ),
    );
    for (const name of released) {
      try {
        await this.dynamicReportProvider.unlockTemplate({ name, ownerId });
      } catch {
        // Template may have been deleted; ignore
      }
      await this.resetStep09ForTemplate(ownerId, name);
    }

    await this.dynamicReportProvider.lockTemplate({ name: templateName, ownerId });

    const status: AnnualAuditStepStatus =
      next.balanceSheet && next.profitAndLoss ? 'COMPLETED' : 'IN_PROGRESS';
    const evidenceJson = JSON.stringify(templateSlotsToEvidence(next));
    const [row] = await upsertStep09Status.run({ ownerId, year, status, evidenceJson }, this.db);

    if (!row) {
      throw new Error('Failed to upsert annual audit step 09 status');
    }
    return this.mapStepStatusRow(row);
  }

  public async resetStep09ForTemplate(ownerId: string, templateName: string): Promise<void> {
    await resetStep09ForTemplate.run({ ownerId, templateName }, this.db);
  }

  // ─── Step 05: working templates ──────────────────────────────────────────

  public async setWorkingTemplate(
    input: SetAnnualAuditWorkingTemplateInput,
  ): Promise<AnnualAuditStepStatusResult> {
    const { ownerId, year, reportType } = input;
    const templateName = input.templateName || null;

    if (templateName) {
      const template = await this.dynamicReportProvider.getTemplate({
        name: templateName,
        ownerId,
      });
      if (!template) {
        throw new Error(`Report template "${templateName}" not found`);
      }
    }

    const [existing] = await getStepStatus.run({ ownerId, year, stepId: '5' }, this.db);
    const current = this.readWorkingSlots(existing?.evidence_json);
    const next = assignTemplateSlot(current, templateName, reportType);

    // Keep any unrelated evidence keys step 05 may carry
    const otherEvidence =
      existing?.evidence_json && typeof existing.evidence_json === 'object'
        ? Object.fromEntries(
            Object.entries(existing.evidence_json as Record<string, unknown>).filter(
              ([key]) => key !== 'balanceSheetTemplateName' && key !== 'profitAndLossTemplateName',
            ),
          )
        : {};
    const evidenceJson = JSON.stringify({ ...otherEvidence, ...templateSlotsToEvidence(next) });

    const [row] = await upsertStep05Evidence.run({ ownerId, year, evidenceJson }, this.db);
    if (!row) {
      throw new Error('Failed to save annual audit working template');
    }
    return this.mapStepStatusRow(row);
  }

  /** Follows a dynamic report template rename in every year's working templates. */
  public async renameWorkingTemplate(
    ownerId: string,
    prevName: string,
    newName: string,
  ): Promise<void> {
    await renameWorkingTemplate.run({ ownerId, prevName, newName }, this.db);
  }

  /** Forgets a deleted dynamic report template in every year's working templates. */
  public async removeWorkingTemplate(ownerId: string, templateName: string): Promise<void> {
    await removeWorkingTemplate.run({ ownerId, templateName }, this.db);
  }

  /**
   * Working slots are stored explicitly — unlike final templates, an unset working slot must not be
   * filled from the other one, so clearing one report's working template doesn't silently keep it.
   */
  private readWorkingSlots(evidence: unknown): TemplateSlots {
    const raw = (evidence ?? {}) as Record<string, unknown>;
    const pick = (value: unknown) => (typeof value === 'string' && value ? value : null);
    return {
      balanceSheet: pick(raw.balanceSheetTemplateName),
      profitAndLoss: pick(raw.profitAndLossTemplateName),
    };
  }

  private mapStepStatusRow(r: {
    owner_id: string;
    year: number;
    step_id: string;
    status: string;
    notes?: string | null;
    evidence_json?: unknown;
    updated_at: Date;
    completed_at?: Date | null;
  }): AnnualAuditStepStatusResult {
    return {
      id: `${r.owner_id}:${r.year}:${r.step_id}`,
      ownerId: r.owner_id,
      year: r.year,
      stepId: r.step_id,
      status: r.status as AnnualAuditStepStatus,
      notes: r.notes ?? null,
      evidence: r.evidence_json == null ? null : JSON.stringify(r.evidence_json),
      updatedAt: r.updated_at,
      completedAt: r.completed_at ?? null,
    };
  }
}
