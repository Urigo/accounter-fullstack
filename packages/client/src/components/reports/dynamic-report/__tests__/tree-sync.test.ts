import { describe, expect, it } from 'vitest';
import { REPORT_ROOT } from '../utils/report-tree.js';
import { isBuiltFrom, patchLeafValues, type TreeBuildInputs } from '../utils/tree-sync.js';
import type { CustomData, FlatNode } from '../utils/types.js';

/**
 * Drives the two effects' coordination the way the component does, so the load orders below read
 * as the sequences they are. `rebuild` is Effect 1, `patch` is Effect 2, and each returns whether
 * it did any work.
 */
function makeReport() {
  let builtFrom: TreeBuildInputs | null = null;

  return {
    /** Effect 1: records the inputs it rebuilt from. */
    rebuild(inputs: TreeBuildInputs) {
      builtFrom = inputs;
    },
    /** Effect 2: true when it patched, false when it stood down. */
    patch(inputs: TreeBuildInputs): boolean {
      if (isBuiltFrom(builtFrom, inputs)) return false;
      builtFrom = inputs;
      return true;
    },
  };
}

const NO_SUMS: readonly unknown[] = [];
const SUMS: readonly unknown[] = [{ id: 'entity-1' }];

describe('tree effect coordination', () => {
  it('stands down when the rebuild used these very inputs', () => {
    const report = makeReport();
    const inputs = { businessSums: SUMS, showZeroed: false };

    report.rebuild(inputs);

    expect(report.patch(inputs)).toBe(false);
  });

  // The regression: on a page refresh the template query resolves before the much slower ledger
  // aggregation, so the tree is first built with no figures and every leaf is hidden. The patch
  // when the figures land is the only thing that brings the leaves back — skipping it leaves the
  // report showing branches with no entities and no amounts.
  it('patches when the figures arrive after the template', () => {
    const report = makeReport();

    // Mount: nothing has loaded, and the patch stands down behind the rebuild.
    report.rebuild({ businessSums: NO_SUMS, showZeroed: false });
    expect(report.patch({ businessSums: NO_SUMS, showZeroed: false })).toBe(false);

    // The template lands. Effect 1 rebuilds — still with no figures — and Effect 2 does not run,
    // because its own inputs have not changed.
    report.rebuild({ businessSums: NO_SUMS, showZeroed: false });

    // The figures land. This patch is what un-hides the leaves.
    expect(report.patch({ businessSums: SUMS, showZeroed: false })).toBe(true);
  });

  it('patches when sort codes land between the template and the figures', () => {
    const report = makeReport();

    report.rebuild({ businessSums: NO_SUMS, showZeroed: false });
    expect(report.patch({ businessSums: NO_SUMS, showZeroed: false })).toBe(false);

    // Template, then sort codes — two more rebuilds, still no figures, Effect 2 never runs.
    report.rebuild({ businessSums: NO_SUMS, showZeroed: false });
    report.rebuild({ businessSums: NO_SUMS, showZeroed: false });

    expect(report.patch({ businessSums: SUMS, showZeroed: false })).toBe(true);
  });

  it('patches on a period change, which produces new figures', () => {
    const report = makeReport();
    report.rebuild({ businessSums: SUMS, showZeroed: false });

    const nextPeriod: readonly unknown[] = [{ id: 'entity-1' }];
    expect(report.patch({ businessSums: nextPeriod, showZeroed: false })).toBe(true);
  });

  // The zeroed filter never changes the figures, only which bank rows are shown — so identity of
  // businessSums alone would wrongly stand down here.
  it('patches when only the zeroed filter changes', () => {
    const report = makeReport();
    report.rebuild({ businessSums: SUMS, showZeroed: false });

    expect(report.patch({ businessSums: SUMS, showZeroed: true })).toBe(true);
  });

  it('stands down when a template switch rebuilds with the figures already on screen', () => {
    const report = makeReport();
    report.rebuild({ businessSums: SUMS, showZeroed: false });
    report.patch({ businessSums: SUMS, showZeroed: false });

    // Switching template rebuilds from the same figures; the patch in that commit must not write
    // the pre-rebuild tree back over it.
    report.rebuild({ businessSums: SUMS, showZeroed: false });
    expect(report.patch({ businessSums: SUMS, showZeroed: false })).toBe(false);
  });
});

// ── patchLeafValues ──────────────────────────────────────────────────────────

function sum(id: string, name: string, raw: number, ledgerFingerprint = `fp-${id}`) {
  return { business: { id, name }, total: { raw }, ledgerFingerprint };
}

function patchBranch(id: string): FlatNode<CustomData> {
  return {
    id,
    parent: REPORT_ROOT,
    text: id,
    droppable: true,
    data: { nodeType: 'synthetic-branch', isOpen: true },
  };
}

function patchLeaf(id: string, data: Partial<CustomData> = {}): FlatNode<CustomData> {
  return {
    id,
    parent: 'br-1',
    text: `Entity ${id}`,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false, value: -100, ...data },
  };
}

describe('patchLeafValues', () => {
  it('returns the very same node when value, visibility, name and fingerprint are unchanged', () => {
    const node = patchLeaf('e-1', { fingerprint: 'fp-e-1' });
    const [patched] = patchLeafValues([node], [sum('e-1', 'Entity e-1', 100)]);
    expect(patched).toBe(node);
  });

  it('leaves branches untouched', () => {
    const node = patchBranch('br-1');
    expect(patchLeafValues([node], [])[0]).toBe(node);
  });

  it('patches the fingerprint when only the fingerprint changed', () => {
    const node = patchLeaf('e-1', { fingerprint: 'fp-old' });
    const [patched] = patchLeafValues([node], [sum('e-1', 'Entity e-1', 100, 'fp-new')]);
    expect(patched).not.toBe(node);
    expect(patched.data.fingerprint).toBe('fp-new');
    expect(patched.data.value).toBe(-100);
  });

  it('sets the value, name and fingerprint from the sum', () => {
    const node = patchLeaf('e-1');
    const [patched] = patchLeafValues([node], [sum('e-1', 'Renamed', 40)]);
    expect(patched.text).toBe('Renamed');
    expect(patched.data.value).toBe(-40);
    expect(patched.data.fingerprint).toBe('fp-e-1');
  });

  it('hides a leaf with no sum, zeroes it, keeps its name and drops its fingerprint', () => {
    const node = patchLeaf('e-1', { fingerprint: 'fp-e-1' });
    const [patched] = patchLeafValues([node], []);
    expect(patched.data.isHidden).toBe(true);
    expect(patched.data.value).toBe(0);
    expect(patched.text).toBe('Entity e-1');
    expect(patched.data).not.toHaveProperty('fingerprint');
  });

  it('un-hides a leaf whose sum reappears', () => {
    const node = patchLeaf('e-1', { value: 0, isHidden: true });
    const [patched] = patchLeafValues([node], [sum('e-1', 'Back', 10)]);
    expect(patched.data).not.toHaveProperty('isHidden');
    expect(patched.data.fingerprint).toBe('fp-e-1');
  });

  it('preserves structure and every other data field', () => {
    const node = patchLeaf('e-1', { hebrewText: 'שלום', isOpen: true });
    const [patched] = patchLeafValues([node], [sum('e-1', 'X', 5)]);
    expect(patched.parent).toBe('br-1');
    expect(patched.data.hebrewText).toBe('שלום');
    expect(patched.data.isOpen).toBe(true);
  });
});
