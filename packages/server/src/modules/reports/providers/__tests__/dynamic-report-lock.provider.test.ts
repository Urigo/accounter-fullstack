import { GraphQLError } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pgTypedRuntimeMock = vi.hoisted(() => {
  const runMocks = {
    getTemplateRun: vi.fn(),
    getTemplatesByOwnerIdsRun: vi.fn(),
    updateTemplateRun: vi.fn(),
    updateTemplateNameRun: vi.fn(),
    insertTemplateRun: vi.fn(),
    deleteTemplateRun: vi.fn(),
    lockTemplateRun: vi.fn(),
    unlockTemplateRun: vi.fn(),
    insertSnapshotRun: vi.fn(),
  };

  const sql = vi.fn((strings: TemplateStringsArray) => {
    const query = strings.join(' ');

    if (query.includes('WHERE name = $name AND owner_id = $ownerId;')) {
      return { run: runMocks.getTemplateRun };
    }
    if (query.includes('WHERE owner_id IN $$ownerIds;')) {
      return { run: runMocks.getTemplatesByOwnerIdsRun };
    }
    if (query.includes('SET template = $template')) {
      return { run: runMocks.updateTemplateRun };
    }
    if (query.includes('SET name = $newName')) {
      return { run: runMocks.updateTemplateNameRun };
    }
    if (query.includes('INSERT INTO accounter_schema.dynamic_report_template_snapshots')) {
      return { run: runMocks.insertSnapshotRun };
    }
    if (query.includes('INSERT INTO accounter_schema.dynamic_report_templates')) {
      return { run: runMocks.insertTemplateRun };
    }
    if (query.includes('DELETE FROM accounter_schema.dynamic_report_templates')) {
      return { run: runMocks.deleteTemplateRun };
    }
    if (query.includes('SET is_locked = TRUE')) {
      return { run: runMocks.lockTemplateRun };
    }
    if (query.includes('SET is_locked = FALSE')) {
      return { run: runMocks.unlockTemplateRun };
    }
    // Catch-all: SQL from transitively-imported modules (e.g., AdminContextProvider)
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

import { DynamicReportProvider } from '../dynamic-report.provider.js';

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tpl-id',
    name: 'my-template',
    owner_id: 'owner-1',
    template: '[]',
    is_locked: false,
    created: new Date(),
    updated: new Date(),
    ...overrides,
  };
}

describe('DynamicReportProvider — lock/unlock guards', () => {
  let db: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
  let adminContextProvider: { getVerifiedAdminContext: ReturnType<typeof vi.fn> };
  let provider: DynamicReportProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    pgTypedRuntimeMock.reset();

    // The guarded write runs both statements in one transaction, so the mock hands the callback a
    // client and simply runs it — the pgtyped `run` mocks above are what the statements land on.
    db = {
      query: vi.fn(),
      transaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn({ query: vi.fn() })),
    };
    adminContextProvider = {
      getVerifiedAdminContext: vi.fn().mockResolvedValue({ ownerId: 'owner-1' }),
    };
    provider = new DynamicReportProvider(db as never, adminContextProvider as never);
  });

  // ── updateTemplateWithSnapshot ────────────────────────────────────────────

  const templateParams = { name: 'my-template', ownerId: 'owner-1', template: '[]' } as never;

  it('updateTemplateWithSnapshot throws when template is locked', async () => {
    pgTypedRuntimeMock.runMocks.getTemplateRun.mockResolvedValue([makeRow({ is_locked: true })]);

    await expect(
      provider.updateTemplateWithSnapshot({ template: templateParams }),
    ).rejects.toThrow(GraphQLError);

    await expect(
      provider.updateTemplateWithSnapshot({ template: templateParams }),
    ).rejects.toThrow(/locked/);
  });

  it('updateTemplateWithSnapshot does not write when template is locked', async () => {
    pgTypedRuntimeMock.runMocks.getTemplateRun.mockResolvedValue([makeRow({ is_locked: true })]);

    await expect(
      provider.updateTemplateWithSnapshot({ template: templateParams }),
    ).rejects.toThrow(/locked/);

    expect(db.transaction).not.toHaveBeenCalled();
    expect(pgTypedRuntimeMock.runMocks.updateTemplateRun).not.toHaveBeenCalled();
  });

  it('updateTemplateWithSnapshot proceeds when template is unlocked', async () => {
    pgTypedRuntimeMock.runMocks.getTemplateRun.mockResolvedValue([makeRow({ is_locked: false })]);
    pgTypedRuntimeMock.runMocks.updateTemplateRun.mockResolvedValue([makeRow()]);

    await expect(
      provider.updateTemplateWithSnapshot({ template: templateParams }),
    ).resolves.toBeDefined();
  });

  // ── insertSnapshot ────────────────────────────────────────────────────────
  // Capturing a baseline writes a snapshot row and nothing else, so it stays available on a locked
  // template: the annual-audit sign-off that locked it still describes exactly what it approved,
  // and without this a locked draft could never start tracking changes at all.

  const snapshotParams = {
    ownerId: 'owner-1',
    templateName: 'my-template',
    fromDate: '2024-01-01',
    toDate: '2024-12-31',
    scopeOwnerId: 'owner-1',
    tree: '[]',
    leafValues: '{}',
    createdBy: null,
  } as never;

  it('insertSnapshot writes the baseline even when the template is locked', async () => {
    pgTypedRuntimeMock.runMocks.getTemplateRun.mockResolvedValue([makeRow({ is_locked: true })]);
    pgTypedRuntimeMock.runMocks.insertSnapshotRun.mockResolvedValue([{ id: 'snapshot-1' }]);

    await expect(provider.insertSnapshot(snapshotParams)).resolves.toEqual({ id: 'snapshot-1' });
    expect(pgTypedRuntimeMock.runMocks.insertSnapshotRun).toHaveBeenCalledTimes(1);
  });

  it('insertSnapshot leaves the template row untouched', async () => {
    pgTypedRuntimeMock.runMocks.getTemplateRun.mockResolvedValue([makeRow({ is_locked: true })]);
    pgTypedRuntimeMock.runMocks.insertSnapshotRun.mockResolvedValue([{ id: 'snapshot-1' }]);

    await provider.insertSnapshot(snapshotParams);

    expect(pgTypedRuntimeMock.runMocks.updateTemplateRun).not.toHaveBeenCalled();
    expect(pgTypedRuntimeMock.runMocks.insertTemplateRun).not.toHaveBeenCalled();
    expect(pgTypedRuntimeMock.runMocks.updateTemplateNameRun).not.toHaveBeenCalled();
  });

  // ── deleteTemplate ────────────────────────────────────────────────────────

  it('deleteTemplate throws when template is locked', async () => {
    pgTypedRuntimeMock.runMocks.getTemplateRun.mockResolvedValue([makeRow({ is_locked: true })]);

    await expect(
      provider.deleteTemplate({ name: 'my-template', ownerId: 'owner-1' }),
    ).rejects.toThrow(GraphQLError);
  });

  it('deleteTemplate proceeds when template is unlocked', async () => {
    pgTypedRuntimeMock.runMocks.getTemplateRun.mockResolvedValue([makeRow({ is_locked: false })]);
    pgTypedRuntimeMock.runMocks.deleteTemplateRun.mockResolvedValue([{ name: 'my-template' }]);

    await expect(
      provider.deleteTemplate({ name: 'my-template', ownerId: 'owner-1' }),
    ).resolves.toEqual([{ name: 'my-template' }]);
  });

  // ── lockTemplate ──────────────────────────────────────────────────────────

  it('lockTemplate returns updated row', async () => {
    const lockedRow = makeRow({ is_locked: true });
    pgTypedRuntimeMock.runMocks.lockTemplateRun.mockResolvedValue([lockedRow]);

    const result = await provider.lockTemplate({ name: 'my-template', ownerId: 'owner-1' });
    expect(result).toEqual(lockedRow);
  });

  it('lockTemplate throws GraphQLError when template not found', async () => {
    pgTypedRuntimeMock.runMocks.lockTemplateRun.mockResolvedValue([]);

    await expect(
      provider.lockTemplate({ name: 'nonexistent', ownerId: 'owner-1' }),
    ).rejects.toThrow(GraphQLError);
  });

  // ── unlockTemplate ────────────────────────────────────────────────────────

  it('unlockTemplate returns updated row', async () => {
    const unlockedRow = makeRow({ is_locked: false });
    pgTypedRuntimeMock.runMocks.unlockTemplateRun.mockResolvedValue([unlockedRow]);

    const result = await provider.unlockTemplate({ name: 'my-template', ownerId: 'owner-1' });
    expect(result).toEqual(unlockedRow);
  });

  it('unlockTemplate throws GraphQLError when template not found', async () => {
    pgTypedRuntimeMock.runMocks.unlockTemplateRun.mockResolvedValue([]);

    await expect(
      provider.unlockTemplate({ name: 'nonexistent', ownerId: 'owner-1' }),
    ).rejects.toThrow(GraphQLError);
  });

  // ── updateTemplateName ────────────────────────────────────────────────────

  it('updateTemplateName throws when template is locked', async () => {
    pgTypedRuntimeMock.runMocks.getTemplateRun.mockResolvedValue([makeRow({ is_locked: true })]);

    await expect(
      provider.updateTemplateName({ prevName: 'my-template', newName: 'new-name', ownerId: 'owner-1' }),
    ).rejects.toThrow(GraphQLError);
  });
});
