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
    getLatestComparableSnapshotRun: vi.fn(),
    lockTemplateForSnapshotRun: vi.fn(),
  };

  const sql = vi.fn((strings: TemplateStringsArray) => {
    const query = strings.join(' ');

    if (query.includes('FOR NO KEY UPDATE')) {
      return { run: runMocks.lockTemplateForSnapshotRun };
    }
    if (query.includes('scope_owner_id = $scopeOwnerId!')) {
      return { run: runMocks.getLatestComparableSnapshotRun };
    }
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
  let txClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    pgTypedRuntimeMock.reset();

    // The guarded write runs both statements in one transaction, so the mock hands the callback a
    // client and simply runs it — the pgtyped `run` mocks above are what the statements land on.
    txClient = { query: vi.fn() };
    db = {
      query: vi.fn(),
      transaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(txClient)),
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

  // ── stamped snapshot writes ───────────────────────────────────────────────
  // The previous comparable snapshot must be read on the transaction client, after the template's
  // row lock is taken and before the insert, so concurrent saves stamp against the row they follow.

  const snapshotKey = {
    ownerId: 'owner-1',
    templateName: 'my-template',
    fromDate: '2024-01-01',
    toDate: '2024-12-31',
    scopeOwnerId: 'owner-1',
  };
  const builtRow = { ...snapshotKey, tree: '[]', leafValues: '{}', leafApprovals: '{"x":1}' };

  it('updateTemplateWithSnapshot builds the snapshot from the previous one inside the transaction', async () => {
    const previous = { id: 'prev-snapshot' };
    pgTypedRuntimeMock.runMocks.getTemplateRun.mockResolvedValue([makeRow()]);
    pgTypedRuntimeMock.runMocks.updateTemplateRun.mockResolvedValue([makeRow()]);
    pgTypedRuntimeMock.runMocks.getLatestComparableSnapshotRun.mockResolvedValue([previous]);
    pgTypedRuntimeMock.runMocks.insertSnapshotRun.mockResolvedValue([{ id: 'new' }]);
    const buildSnapshot = vi.fn().mockReturnValue(builtRow);

    await provider.updateTemplateWithSnapshot({
      template: templateParams,
      snapshot: { key: snapshotKey, buildSnapshot },
    });

    const { runMocks } = pgTypedRuntimeMock;
    expect(runMocks.getLatestComparableSnapshotRun).toHaveBeenCalledWith(snapshotKey, txClient);
    expect(buildSnapshot).toHaveBeenCalledWith(previous);
    expect(runMocks.insertSnapshotRun).toHaveBeenCalledWith(builtRow, txClient);
    // Order: the UPDATE takes the row lock, then the lookup, then the insert.
    expect(runMocks.updateTemplateRun.mock.invocationCallOrder[0]).toBeLessThan(
      runMocks.getLatestComparableSnapshotRun.mock.invocationCallOrder[0],
    );
    expect(runMocks.getLatestComparableSnapshotRun.mock.invocationCallOrder[0]).toBeLessThan(
      runMocks.insertSnapshotRun.mock.invocationCallOrder[0],
    );
  });

  it('updateTemplateWithSnapshot passes null when there is no previous snapshot', async () => {
    pgTypedRuntimeMock.runMocks.getTemplateRun.mockResolvedValue([makeRow()]);
    pgTypedRuntimeMock.runMocks.updateTemplateRun.mockResolvedValue([makeRow()]);
    pgTypedRuntimeMock.runMocks.getLatestComparableSnapshotRun.mockResolvedValue([]);
    pgTypedRuntimeMock.runMocks.insertSnapshotRun.mockResolvedValue([{ id: 'new' }]);
    const buildSnapshot = vi.fn().mockReturnValue(builtRow);

    await provider.updateTemplateWithSnapshot({
      template: templateParams,
      snapshot: { key: snapshotKey, buildSnapshot },
    });

    expect(buildSnapshot).toHaveBeenCalledWith(null);
  });

  it('updateTemplateWithSnapshot writes no snapshot when the template is missing', async () => {
    pgTypedRuntimeMock.runMocks.getTemplateRun.mockResolvedValue([]);
    pgTypedRuntimeMock.runMocks.updateTemplateRun.mockResolvedValue([]);
    const buildSnapshot = vi.fn().mockReturnValue(builtRow);

    await expect(
      provider.updateTemplateWithSnapshot({
        template: templateParams,
        snapshot: { key: snapshotKey, buildSnapshot },
      }),
    ).resolves.toBeUndefined();

    expect(buildSnapshot).not.toHaveBeenCalled();
    expect(pgTypedRuntimeMock.runMocks.insertSnapshotRun).not.toHaveBeenCalled();
  });

  it('updateTemplateWithSnapshot without a snapshot skips the lookup', async () => {
    pgTypedRuntimeMock.runMocks.getTemplateRun.mockResolvedValue([makeRow()]);
    pgTypedRuntimeMock.runMocks.updateTemplateRun.mockResolvedValue([makeRow()]);

    await provider.updateTemplateWithSnapshot({ template: templateParams });

    expect(pgTypedRuntimeMock.runMocks.getLatestComparableSnapshotRun).not.toHaveBeenCalled();
    expect(pgTypedRuntimeMock.runMocks.insertSnapshotRun).not.toHaveBeenCalled();
  });

  it('captureSnapshot locks the template, then reads the previous snapshot and inserts', async () => {
    const locked = makeRow({ is_locked: true });
    const previous = { id: 'prev-snapshot' };
    pgTypedRuntimeMock.runMocks.lockTemplateForSnapshotRun.mockResolvedValue([locked]);
    pgTypedRuntimeMock.runMocks.getLatestComparableSnapshotRun.mockResolvedValue([previous]);
    pgTypedRuntimeMock.runMocks.insertSnapshotRun.mockResolvedValue([{ id: 'new' }]);
    const buildSnapshot = vi.fn().mockReturnValue(builtRow);

    // A locked template is fine: capture never writes the template row.
    await expect(provider.captureSnapshot({ key: snapshotKey, buildSnapshot })).resolves.toBe(
      locked,
    );

    const { runMocks } = pgTypedRuntimeMock;
    expect(runMocks.lockTemplateForSnapshotRun).toHaveBeenCalledWith(
      { name: 'my-template', ownerId: 'owner-1' },
      txClient,
    );
    expect(runMocks.getLatestComparableSnapshotRun).toHaveBeenCalledWith(snapshotKey, txClient);
    expect(buildSnapshot).toHaveBeenCalledWith(previous);
    expect(runMocks.insertSnapshotRun).toHaveBeenCalledWith(builtRow, txClient);
    expect(runMocks.lockTemplateForSnapshotRun.mock.invocationCallOrder[0]).toBeLessThan(
      runMocks.getLatestComparableSnapshotRun.mock.invocationCallOrder[0],
    );
    expect(runMocks.updateTemplateRun).not.toHaveBeenCalled();
  });

  it('captureSnapshot writes nothing when the template does not exist', async () => {
    pgTypedRuntimeMock.runMocks.lockTemplateForSnapshotRun.mockResolvedValue([]);
    const buildSnapshot = vi.fn().mockReturnValue(builtRow);

    await expect(
      provider.captureSnapshot({ key: snapshotKey, buildSnapshot }),
    ).resolves.toBeUndefined();

    expect(pgTypedRuntimeMock.runMocks.getLatestComparableSnapshotRun).not.toHaveBeenCalled();
    expect(buildSnapshot).not.toHaveBeenCalled();
    expect(pgTypedRuntimeMock.runMocks.insertSnapshotRun).not.toHaveBeenCalled();
  });

  it('getLatestComparableSnapshot uses the request client when no client is given', async () => {
    pgTypedRuntimeMock.runMocks.getLatestComparableSnapshotRun.mockResolvedValue([]);

    await expect(provider.getLatestComparableSnapshot(snapshotKey)).resolves.toBeNull();
    expect(pgTypedRuntimeMock.runMocks.getLatestComparableSnapshotRun).toHaveBeenCalledWith(
      snapshotKey,
      db,
    );
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
    leafFingerprints: null,
    leafApprovals: null,
    createdBy: null,
  } as never;

  it('insertSnapshot writes the baseline even when the template is locked', async () => {
    pgTypedRuntimeMock.runMocks.getTemplateRun.mockResolvedValue([makeRow({ is_locked: true })]);
    pgTypedRuntimeMock.runMocks.insertSnapshotRun.mockResolvedValue([{ id: 'snapshot-1' }]);

    await expect(provider.insertSnapshot(snapshotParams)).resolves.toEqual({ id: 'snapshot-1' });
    expect(pgTypedRuntimeMock.runMocks.insertSnapshotRun).toHaveBeenCalledTimes(1);
    expect(pgTypedRuntimeMock.runMocks.insertSnapshotRun).toHaveBeenCalledWith(
      expect.objectContaining({ leafFingerprints: null, leafApprovals: null }),
      expect.anything(),
    );
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
