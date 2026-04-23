import { describe, expect, it } from 'vitest';
import {
  isLegacyTemplate,
  migrateLegacyTemplate,
  parseTemplate,
} from '../dynamic-report.helper.js';

describe('parseTemplate', () => {
  it('succeeds with a valid new-format JSON string', () => {
    const nodes = [
      {
        id: '1',
        parent: '0',
        text: 'Root',
        droppable: true,
        data: { nodeType: 'synthetic-branch', isOpen: false },
      },
      {
        id: 'uuid-abc',
        parent: '1',
        text: 'Entity A',
        droppable: false,
        data: { nodeType: 'financial-entity', isOpen: false },
      },
    ];
    const result = parseTemplate(JSON.stringify(nodes));
    expect(result).toHaveLength(2);
    expect(result[0].data.nodeType).toBe('synthetic-branch');
    expect(result[1].data.nodeType).toBe('financial-entity');
  });

  it('throws on a JSON string missing nodeType', () => {
    const nodes = [
      {
        id: '1',
        parent: '0',
        text: 'Root',
        droppable: true,
        data: { isOpen: false },
      },
    ];
    expect(() => parseTemplate(JSON.stringify(nodes))).toThrow();
  });
});

describe('isLegacyTemplate', () => {
  it('returns true when at least one node data has descendantSortCodes', () => {
    const nodes = [
      {
        id: '1',
        parent: '0',
        text: 'Branch',
        droppable: true,
        data: { descendantSortCodes: [100], isOpen: false },
      },
    ];
    expect(isLegacyTemplate(nodes)).toBe(true);
  });

  it('returns false when no node has descendantSortCodes', () => {
    const nodes = [
      {
        id: '1',
        parent: '0',
        text: 'Branch',
        droppable: true,
        data: { nodeType: 'synthetic-branch', isOpen: false },
      },
    ];
    expect(isLegacyTemplate(nodes)).toBe(false);
  });
});

describe('migrateLegacyTemplate', () => {
  const ENTITY_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ENTITY_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const legacyTree = [
    {
      id: 'branch-1',
      parent: '0',
      text: 'Sort Code 100',
      droppable: true,
      data: {
        sortCode: 100,
        descendantSortCodes: [100],
        descendantFinancialEntities: [ENTITY_A, ENTITY_B],
        mergedSortCodes: null,
        isOpen: false,
      },
    },
  ];

  it('migrates the branch node with nodeType sort-code-branch', () => {
    const result = migrateLegacyTemplate(legacyTree, new Map());
    const branch = result.find(n => n.id === 'branch-1');
    expect(branch).toBeDefined();
    expect(branch!.data.nodeType).toBe('sort-code-branch');
    expect(branch!.droppable).toBe(true);
  });

  it('creates explicit leaf nodes for each entity in descendantFinancialEntities', () => {
    const result = migrateLegacyTemplate(legacyTree, new Map());
    const leafA = result.find(n => n.id === ENTITY_A);
    const leafB = result.find(n => n.id === ENTITY_B);
    expect(leafA).toBeDefined();
    expect(leafA!.data.nodeType).toBe('financial-entity');
    expect(leafA!.parent).toBe('branch-1');
    expect(leafB).toBeDefined();
    expect(leafB!.data.nodeType).toBe('financial-entity');
    expect(leafB!.parent).toBe('branch-1');
  });

  it('migrates a branch without sortCode to nodeType synthetic-branch', () => {
    const syntheticTree = [
      {
        id: 'synth-1',
        parent: '0',
        text: 'Synthetic Category',
        droppable: true,
        data: {
          descendantSortCodes: null,
          descendantFinancialEntities: [ENTITY_A],
          mergedSortCodes: null,
          isOpen: true,
        },
      },
    ];
    const result = migrateLegacyTemplate(syntheticTree, new Map());
    const branch = result.find(n => n.id === 'synth-1');
    expect(branch).toBeDefined();
    expect(branch!.data.nodeType).toBe('synthetic-branch');
  });

  it('does not duplicate a leaf that already exists explicitly', () => {
    const treeWithExplicitLeaf = [
      ...legacyTree,
      {
        id: ENTITY_A,
        parent: 'branch-1',
        text: 'Existing Leaf',
        droppable: false,
        data: {
          descendantSortCodes: undefined,
          descendantFinancialEntities: undefined,
          mergedSortCodes: undefined,
          isOpen: false,
        },
      },
    ];

    const result = migrateLegacyTemplate(treeWithExplicitLeaf, new Map());
    const leafAEntries = result.filter(n => n.id === ENTITY_A);
    expect(leafAEntries).toHaveLength(1);
  });
});
