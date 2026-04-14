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
    if (query.includes("VALUES ($ownerId, $year, '9', 'COMPLETED'")) {
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

  it('locks the new template and sets step 09 to COMPLETED on first call (no existing)', async () => {
    pgTypedRuntimeMock.runMocks.getStepStatusRun.mockResolvedValue([]);
    dynamicReportProviderMock.lockTemplate.mockResolvedValue({ name: 'template-A', is_locked: true });
    pgTypedRuntimeMock.runMocks.upsertStep09StatusRun.mockResolvedValue([
      makeStepRow({ evidence_json: { lockedTemplateName: 'template-A' } }),
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
    expect(result.status).toBe('COMPLETED');
    expect(result.stepId).toBe('9');
    expect(result.evidence).toBe(JSON.stringify({ lockedTemplateName: 'template-A' }));
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
