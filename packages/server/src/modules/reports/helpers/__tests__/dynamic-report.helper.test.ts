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

  it('injects leaves from entityBySortCode for a sort code with no explicit branch node', () => {
    const ENTITY_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    // Branch has descendantSortCodes: [200] but no sortCode and no descendantFinancialEntities.
    // Sort code 200 has no explicit branch node in the template, so its entities must come
    // from entityBySortCode.
    const tree = [
      {
        id: 'synth-2',
        parent: '0',
        text: 'Synthetic',
        droppable: true,
        data: {
          descendantSortCodes: [200],
          descendantFinancialEntities: null,
          mergedSortCodes: null,
          isOpen: false,
        },
      },
    ];
    const entityBySortCode = new Map([[200, [ENTITY_C]]]);
    const result = migrateLegacyTemplate(tree, entityBySortCode);

    const branch = result.find(n => n.id === 'synth-2');
    expect(branch?.data.nodeType).toBe('synthetic-branch');

    const leaf = result.find(n => n.id === ENTITY_C);
    expect(leaf).toBeDefined();
    expect(leaf!.data.nodeType).toBe('financial-entity');
    expect(leaf!.parent).toBe('synth-2');
  });

  it('skips entityBySortCode lookup for a sort code that has an explicit branch node', () => {
    const ENTITY_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const ENTITY_D = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    // Parent synthetic branch groups two sort codes: 100 (explicit branch node) and 300 (no node).
    // Sort code 100's entities should come from its own branch's descendantFinancialEntities.
    // Sort code 300's entities should come from entityBySortCode because it has no branch node.
    const tree = [
      {
        id: 'parent',
        parent: '0',
        text: 'Parent',
        droppable: true,
        data: {
          descendantSortCodes: [100, 300],
          descendantFinancialEntities: null,
          mergedSortCodes: null,
          isOpen: false,
        },
      },
      {
        id: 'sc-branch',
        parent: 'parent',
        text: 'Sort Code 100',
        droppable: true,
        data: {
          sortCode: 100,
          descendantSortCodes: [100],
          descendantFinancialEntities: [ENTITY_A],
          mergedSortCodes: null,
          isOpen: false,
        },
      },
    ];
    const entityBySortCode = new Map([
      [100, [ENTITY_C]], // should be ignored — sort code 100 has an explicit branch node
      [300, [ENTITY_D]], // should be injected under 'parent' — sort code 300 has no node
    ]);
    const result = migrateLegacyTemplate(tree, entityBySortCode);

    // ENTITY_A comes from sc-branch's descendantFinancialEntities, parented to sc-branch
    const leafA = result.find(n => n.id === ENTITY_A);
    expect(leafA).toBeDefined();
    expect(leafA!.parent).toBe('sc-branch');

    // ENTITY_C must NOT appear — sort code 100 is covered by its own branch node
    expect(result.find(n => n.id === ENTITY_C)).toBeUndefined();

    // ENTITY_D must appear, parented to 'parent' (the branch that listed sort code 300)
    const leafD = result.find(n => n.id === ENTITY_D);
    expect(leafD).toBeDefined();
    expect(leafD!.parent).toBe('parent');
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
