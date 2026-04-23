import { describe, expect, it } from 'vitest';
import { serializeReportTree } from '../template-serialization.js';
import { REPORT_ROOT } from '../report-tree.js';
import { BANK_ROOT } from '../bank-tree.js';
import type { CustomData, FlatNode } from '../types.js';

function branch(
  id: string,
  parent: string,
  opts: { hebrewText?: string; sortCode?: number } = {},
): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Branch ${id}`,
    droppable: true,
    data: {
      nodeType: 'synthetic-branch',
      isOpen: true,
      ...opts,
    },
  };
}

function sortCodeBranch(id: string, parent: string, sortCode: number): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Sort Code ${sortCode}`,
    droppable: true,
    data: { nodeType: 'sort-code-branch', isOpen: false, sortCode },
  };
}

function entity(
  id: string,
  parent: string,
  opts: { value?: number; entityType?: 'business' | 'person' } = {},
): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Entity ${id}`,
    droppable: false,
    data: {
      nodeType: 'financial-entity',
      isOpen: false,
      value: opts.value ?? 100,
      entityType: opts.entityType ?? 'business',
    },
  };
}

describe('serializeReportTree', () => {
  it('returns valid JSON', () => {
    const nodes = [branch('br-1', REPORT_ROOT), entity('e-1', 'br-1')];
    const json = serializeReportTree(nodes);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('value field is absent from serialized entity nodes', () => {
    const nodes = [entity('e-1', REPORT_ROOT)];
    const parsed: { data: Record<string, unknown> }[] = JSON.parse(serializeReportTree(nodes));
    expect(parsed[0].data).not.toHaveProperty('value');
  });

  it('entityType field is absent from serialized entity nodes', () => {
    const nodes = [entity('e-1', REPORT_ROOT, { entityType: 'person' })];
    const parsed: { data: Record<string, unknown> }[] = JSON.parse(serializeReportTree(nodes));
    expect(parsed[0].data).not.toHaveProperty('entityType');
  });

  it('hebrewText is present when set', () => {
    const nodes = [branch('br-1', REPORT_ROOT, { hebrewText: 'שלום' })];
    const parsed: { data: { hebrewText?: string } }[] = JSON.parse(serializeReportTree(nodes));
    expect(parsed[0].data.hebrewText).toBe('שלום');
  });

  it('hebrewText is absent when not set', () => {
    const nodes = [branch('br-1', REPORT_ROOT)];
    const parsed: { data: Record<string, unknown> }[] = JSON.parse(serializeReportTree(nodes));
    expect(parsed[0].data).not.toHaveProperty('hebrewText');
  });

  it('bank nodes (parent = bank root) are excluded', () => {
    const nodes = [
      branch('br-report', REPORT_ROOT),
      entity('e-report', 'br-report'),
      branch('br-bank', BANK_ROOT),
      entity('e-bank', 'br-bank'),
    ];
    const parsed: { id: string }[] = JSON.parse(serializeReportTree(nodes));
    const ids = parsed.map(n => n.id);
    expect(ids).toContain('br-report');
    expect(ids).toContain('e-report');
    expect(ids).not.toContain('br-bank');
    expect(ids).not.toContain('e-bank');
  });

  it('bank nodes with parent = BANK_ROOT are excluded even if mixed with report nodes', () => {
    const nodes = [
      entity('e-bank-root', BANK_ROOT),
      entity('e-report-root', REPORT_ROOT),
    ];
    const parsed: { id: string }[] = JSON.parse(serializeReportTree(nodes));
    expect(parsed.map(n => n.id)).toEqual(['e-report-root']);
  });

  it('isOpen is preserved', () => {
    const nodes = [
      { ...branch('br-1', REPORT_ROOT), data: { nodeType: 'synthetic-branch' as const, isOpen: true } },
    ];
    const parsed: { data: { isOpen: boolean } }[] = JSON.parse(serializeReportTree(nodes));
    expect(parsed[0].data.isOpen).toBe(true);
  });

  it('nodeType is preserved', () => {
    const nodes = [sortCodeBranch('sc-1', REPORT_ROOT, 100), entity('e-1', 'sc-1')];
    const parsed: { id: string; data: { nodeType: string } }[] = JSON.parse(
      serializeReportTree(nodes),
    );
    expect(parsed.find(n => n.id === 'sc-1')!.data.nodeType).toBe('sort-code-branch');
  });

  it('sortCode is preserved for sort-code branches', () => {
    const nodes = [sortCodeBranch('sc-1', REPORT_ROOT, 42)];
    const parsed: { data: { sortCode?: number } }[] = JSON.parse(serializeReportTree(nodes));
    expect(parsed[0].data.sortCode).toBe(42);
  });

  it('empty input returns empty array JSON', () => {
    expect(serializeReportTree([])).toBe('[]');
  });

  it('preserves nested branch parent IDs', () => {
    const nodes = [
      branch('parent-br', REPORT_ROOT),
      branch('child-br', 'parent-br'),
      entity('e-1', 'child-br'),
    ];
    const parsed: { id: string; parent: string }[] = JSON.parse(serializeReportTree(nodes));
    expect(parsed.find(n => n.id === 'child-br')!.parent).toBe('parent-br');
    expect(parsed.find(n => n.id === 'e-1')!.parent).toBe('child-br');
  });
});
