import { beforeEach, describe, expect, it, vi } from 'vitest';

const pgTypedRuntimeMock = vi.hoisted(() => {
  const runMocks = {
    getStepStatusesRun: vi.fn(),
    getStepStatusRun: vi.fn(),
    upsertStepStatusRun: vi.fn(),
    upsertStep09StatusRun: vi.fn(),
    resetStep09ForTemplateRun: vi.fn(),
    getBalanceChargeRun: vi.fn(),
  };

  const sql = vi.fn((strings: TemplateStringsArray) => {
    const query = strings.join(' ');

    if (
      query.includes('WHERE owner_id = $ownerId AND year = $year AND step_id = $stepId;')
    ) {
      return { run: runMocks.getStepStatusRun };
    }
    if (
      query.includes('WHERE owner_id = $ownerId AND year = $year;')
    ) {
      return { run: runMocks.getStepStatusesRun };
    }
    if (query.includes("$ownerId, $year, '9', $status")) {
      return { run: runMocks.upsertStep09StatusRun };
    }
    if (query.includes('VALUES ($ownerId, $year, $stepId, $status')) {
      return { run: runMocks.upsertStepStatusRun };
    }
    if (
      query.includes("evidence_json->>'lockedTemplateName' = $templateName")
    ) {
      return { run: runMocks.resetStep09ForTemplateRun };
    }
    if (query.includes('user_description ILIKE')) {
      return { run: runMocks.getBalanceChargeRun };
    }
    // Catch-all: SQL from transitively-imported modules
    return { run: vi.fn().mockResolvedValue([]) };
  });

  return {
    runMocks,
    sql,
    reset() {
      for (const mock of Object.values(runMocks)) {
        mock.mockReset();
      }
    },
  };
});

vi.mock('@pgtyped/runtime', () => ({
  sql: pgTypedRuntimeMock.sql,
}));

const dynamicReportProviderMock = {
  lockTemplate: vi.fn(),
  unlockTemplate: vi.fn(),
};

vi.mock('../../reports/providers/dynamic-report.provider.js', () => ({
  DynamicReportProvider: class {
    lockTemplate = dynamicReportProviderMock.lockTemplate;
    unlockTemplate = dynamicReportProviderMock.unlockTemplate;
  },
}));

const adminContextProviderMock = {
  getVerifiedAdminContext: vi.fn(),
};

vi.mock('../../admin-context/providers/admin-context.provider.js', () => ({
  AdminContextProvider: class {
    getVerifiedAdminContext = adminContextProviderMock.getVerifiedAdminContext;
  },
}));

import { AnnualAuditProvider } from '../annual-audit.provider.js';

function makeStepRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    owner_id: 'owner-1',
    year: 2024,
    step_id: '9',
    status: 'COMPLETED',
    notes: null,
    evidence_json: null,
    updated_at: new Date(),
    completed_at: new Date(),
    ...overrides,
  };
}

describe('AnnualAuditProvider — setStep09Status', () => {
  let db: { query: ReturnType<typeof vi.fn> };
  let provider: AnnualAuditProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    pgTypedRuntimeMock.reset();

    db = { query: vi.fn() };
    adminContextProviderMock.getVerifiedAdminContext.mockResolvedValue({ ownerId: 'owner-1' });

    provider = new AnnualAuditProvider(
      adminContextProviderMock as never,
      dynamicReportProviderMock as never,
      db as never,
    );
  });

  it('locks the template for both reports and completes step 09 when reportType is omitted', async () => {
    pgTypedRuntimeMock.runMocks.getStepStatusRun.mockResolvedValue([]);
    dynamicReportProviderMock.lockTemplate.mockResolvedValue({ name: 'template-A', is_locked: true });
    const evidence = {
      balanceSheetTemplateName: 'template-A',
      profitAndLossTemplateName: 'template-A',
    };
    pgTypedRuntimeMock.runMocks.upsertStep09StatusRun.mockResolvedValue([
      makeStepRow({ evidence_json: evidence }),
    ]);

    const result = await provider.setStep09Status({
      ownerId: 'owner-1',
      year: 2024,
      templateName: 'template-A',
    });

    expect(dynamicReportProviderMock.unlockTemplate).not.toHaveBeenCalled();
    expect(dynamicReportProviderMock.lockTemplate).toHaveBeenCalledWith({
      name: 'template-A',
      ownerId: 'owner-1',
    });
    expect(pgTypedRuntimeMock.runMocks.upsertStep09StatusRun).toHaveBeenCalledWith(
      {
        ownerId: 'owner-1',
        year: 2024,
        status: 'COMPLETED',
        evidenceJson: JSON.stringify(evidence),
      },
      db,
    );
    expect(result.status).toBe('COMPLETED');
    expect(result.stepId).toBe('9');
    expect(result.evidence).toBe(JSON.stringify(evidence));
  });

  it('keeps step 09 IN_PROGRESS while only one report template is locked', async () => {
    pgTypedRuntimeMock.runMocks.getStepStatusRun.mockResolvedValue([]);
    dynamicReportProviderMock.lockTemplate.mockResolvedValue({ name: 'bs-2024', is_locked: true });
    pgTypedRuntimeMock.runMocks.upsertStep09StatusRun.mockResolvedValue([makeStepRow()]);

    await provider.setStep09Status({
      ownerId: 'owner-1',
      year: 2024,
      templateName: 'bs-2024',
      reportType: 'BALANCE_SHEET',
    });

    expect(pgTypedRuntimeMock.runMocks.upsertStep09StatusRun).toHaveBeenCalledWith(
      {
        ownerId: 'owner-1',
        year: 2024,
        status: 'IN_PROGRESS',
        evidenceJson: JSON.stringify({ balanceSheetTemplateName: 'bs-2024' }),
      },
      db,
    );
  });

  it('completes step 09 once the second report template is locked', async () => {
    pgTypedRuntimeMock.runMocks.getStepStatusRun.mockResolvedValue([
      makeStepRow({ status: 'IN_PROGRESS', evidence_json: { balanceSheetTemplateName: 'bs-2024' } }),
    ]);
    dynamicReportProviderMock.lockTemplate.mockResolvedValue({ name: 'pnl-2024', is_locked: true });
    pgTypedRuntimeMock.runMocks.upsertStep09StatusRun.mockResolvedValue([makeStepRow()]);

    await provider.setStep09Status({
      ownerId: 'owner-1',
      year: 2024,
      templateName: 'pnl-2024',
      reportType: 'PROFIT_AND_LOSS',
    });

    expect(dynamicReportProviderMock.unlockTemplate).not.toHaveBeenCalled();
    expect(pgTypedRuntimeMock.runMocks.upsertStep09StatusRun).toHaveBeenCalledWith(
      {
        ownerId: 'owner-1',
        year: 2024,
        status: 'COMPLETED',
        evidenceJson: JSON.stringify({
          balanceSheetTemplateName: 'bs-2024',
          profitAndLossTemplateName: 'pnl-2024',
        }),
      },
      db,
    );
  });

  it('replacing one report keeps the shared template locked while the other report uses it', async () => {
    pgTypedRuntimeMock.runMocks.getStepStatusRun.mockResolvedValue([
      makeStepRow({
        evidence_json: {
          balanceSheetTemplateName: 'shared',
          profitAndLossTemplateName: 'shared',
        },
      }),
    ]);
    dynamicReportProviderMock.lockTemplate.mockResolvedValue({ name: 'bs-new', is_locked: true });
    pgTypedRuntimeMock.runMocks.upsertStep09StatusRun.mockResolvedValue([makeStepRow()]);

    await provider.setStep09Status({
      ownerId: 'owner-1',
      year: 2024,
      templateName: 'bs-new',
      reportType: 'BALANCE_SHEET',
    });

    expect(dynamicReportProviderMock.unlockTemplate).not.toHaveBeenCalled();
    expect(pgTypedRuntimeMock.runMocks.resetStep09ForTemplateRun).not.toHaveBeenCalled();
  });

  it('replacing one report unlocks its old template when nothing else uses it', async () => {
    pgTypedRuntimeMock.runMocks.getStepStatusRun.mockResolvedValue([
      makeStepRow({
        evidence_json: {
          balanceSheetTemplateName: 'bs-old',
          profitAndLossTemplateName: 'pnl',
        },
      }),
    ]);
    dynamicReportProviderMock.unlockTemplate.mockResolvedValue({ name: 'bs-old', is_locked: false });
    dynamicReportProviderMock.lockTemplate.mockResolvedValue({ name: 'bs-new', is_locked: true });
    pgTypedRuntimeMock.runMocks.upsertStep09StatusRun.mockResolvedValue([makeStepRow()]);

    await provider.setStep09Status({
      ownerId: 'owner-1',
      year: 2024,
      templateName: 'bs-new',
      reportType: 'BALANCE_SHEET',
    });

    expect(dynamicReportProviderMock.unlockTemplate).toHaveBeenCalledTimes(1);
    expect(dynamicReportProviderMock.unlockTemplate).toHaveBeenCalledWith({
      name: 'bs-old',
      ownerId: 'owner-1',
    });
    expect(pgTypedRuntimeMock.runMocks.resetStep09ForTemplateRun).toHaveBeenCalledWith(
      { ownerId: 'owner-1', templateName: 'bs-old' },
      db,
    );
  });

  it('legacy single-template evidence keeps serving the report that is not being replaced', async () => {
    pgTypedRuntimeMock.runMocks.getStepStatusRun.mockResolvedValue([
      makeStepRow({ evidence_json: { lockedTemplateName: 'legacy' } }),
    ]);
    dynamicReportProviderMock.lockTemplate.mockResolvedValue({ name: 'pnl-new', is_locked: true });
    pgTypedRuntimeMock.runMocks.upsertStep09StatusRun.mockResolvedValue([makeStepRow()]);

    await provider.setStep09Status({
      ownerId: 'owner-1',
      year: 2024,
      templateName: 'pnl-new',
      reportType: 'PROFIT_AND_LOSS',
    });

    expect(dynamicReportProviderMock.unlockTemplate).not.toHaveBeenCalled();
    expect(pgTypedRuntimeMock.runMocks.upsertStep09StatusRun).toHaveBeenCalledWith(
      {
        ownerId: 'owner-1',
        year: 2024,
        status: 'COMPLETED',
        evidenceJson: JSON.stringify({
          balanceSheetTemplateName: 'legacy',
          profitAndLossTemplateName: 'pnl-new',
        }),
      },
      db,
    );
  });

  it('unlocks the old template and locks the new one on re-selection', async () => {
    pgTypedRuntimeMock.runMocks.getStepStatusRun.mockResolvedValue([
      makeStepRow({ evidence_json: { lockedTemplateName: 'template-A' } }),
    ]);
    dynamicReportProviderMock.unlockTemplate.mockResolvedValue({ name: 'template-A', is_locked: false });
    dynamicReportProviderMock.lockTemplate.mockResolvedValue({ name: 'template-B', is_locked: true });
    pgTypedRuntimeMock.runMocks.upsertStep09StatusRun.mockResolvedValue([
      makeStepRow({ evidence_json: { lockedTemplateName: 'template-B' } }),
    ]);

    await provider.setStep09Status({
      ownerId: 'owner-1',
      year: 2024,
      templateName: 'template-B',
    });

    expect(dynamicReportProviderMock.unlockTemplate).toHaveBeenCalledWith({
      name: 'template-A',
      ownerId: 'owner-1',
    });
    expect(dynamicReportProviderMock.lockTemplate).toHaveBeenCalledWith({
      name: 'template-B',
      ownerId: 'owner-1',
    });
  });

  it('does not unlock the old template when re-selecting the same template', async () => {
    pgTypedRuntimeMock.runMocks.getStepStatusRun.mockResolvedValue([
      makeStepRow({ evidence_json: { lockedTemplateName: 'template-A' } }),
    ]);
    dynamicReportProviderMock.lockTemplate.mockResolvedValue({ name: 'template-A', is_locked: true });
    pgTypedRuntimeMock.runMocks.upsertStep09StatusRun.mockResolvedValue([
      makeStepRow({ evidence_json: { lockedTemplateName: 'template-A' } }),
    ]);

    await provider.setStep09Status({
      ownerId: 'owner-1',
      year: 2024,
      templateName: 'template-A',
    });

    expect(dynamicReportProviderMock.unlockTemplate).not.toHaveBeenCalled();
    expect(dynamicReportProviderMock.lockTemplate).toHaveBeenCalledWith({
      name: 'template-A',
      ownerId: 'owner-1',
    });
  });

  it('swallows unlock error when previous template has been deleted', async () => {
    pgTypedRuntimeMock.runMocks.getStepStatusRun.mockResolvedValue([
      makeStepRow({ evidence_json: { lockedTemplateName: 'deleted-template' } }),
    ]);
    dynamicReportProviderMock.unlockTemplate.mockRejectedValue(new Error('not found'));
    dynamicReportProviderMock.lockTemplate.mockResolvedValue({ name: 'template-B', is_locked: true });
    pgTypedRuntimeMock.runMocks.upsertStep09StatusRun.mockResolvedValue([
      makeStepRow({ evidence_json: { lockedTemplateName: 'template-B' } }),
    ]);

    await expect(
      provider.setStep09Status({
        ownerId: 'owner-1',
        year: 2024,
        templateName: 'template-B',
      }),
    ).resolves.toBeDefined();
  });

  it('throws when upsertStep09Status returns no rows', async () => {
    pgTypedRuntimeMock.runMocks.getStepStatusRun.mockResolvedValue([]);
    dynamicReportProviderMock.lockTemplate.mockResolvedValue({ name: 'template-A', is_locked: true });
    pgTypedRuntimeMock.runMocks.upsertStep09StatusRun.mockResolvedValue([]);

    await expect(
      provider.setStep09Status({ ownerId: 'owner-1', year: 2024, templateName: 'template-A' }),
    ).rejects.toThrow('Failed to upsert annual audit step 09 status');
  });
});

describe('AnnualAuditProvider — resetStep09ForTemplate', () => {
  let db: { query: ReturnType<typeof vi.fn> };
  let provider: AnnualAuditProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    pgTypedRuntimeMock.reset();
    db = { query: vi.fn() };
    provider = new AnnualAuditProvider(
      adminContextProviderMock as never,
      dynamicReportProviderMock as never,
      db as never,
    );
  });

  it('calls the reset SQL and resolves', async () => {
    pgTypedRuntimeMock.runMocks.resetStep09ForTemplateRun.mockResolvedValue([]);

    await expect(
      provider.resetStep09ForTemplate('owner-1', 'template-A'),
    ).resolves.toBeUndefined();

    expect(pgTypedRuntimeMock.runMocks.resetStep09ForTemplateRun).toHaveBeenCalledWith(
      { ownerId: 'owner-1', templateName: 'template-A' },
      db,
    );
  });
});

