# Dynamic Report Refactor — Implementation Blueprint

## Scope and Baseline

All remaining work targets:

- **Client**: `packages/client/src/components/reports/dynamic-report-2/`
- **Server**: `packages/server/src/modules/reports/`

Current technical baseline in `dynamic-report-2`:

- `FlatNode<CustomData>` flat array as the tree data model
- Pragmatic DnD (`draggable`, `dropTargetForElements`, `monitorForElements`) for all drag
  interactions
- Node-type aware data model (`synthetic-branch`, `sort-code-branch`, `financial-entity`)
- Two separate state slices (`bankTree` / `reportTree`), rendered side-by-side
- Toolbar, template manager modal, rename/delete/new-branch dialogs, legacy banner all wired

**Known baseline gaps** (must be addressed before going to production):

- `cross-tree-drop.ts` is imported by `index.tsx` and `tree-node.tsx` but **does not exist** — the
  app does not build
- `CustomData` in `types.ts` is missing `hebrewText?: string` (present in the spec, in the DB
  template JSON, and in the old `dynamic-report` implementation)
- Delete-branch handler reroots only direct children, dropping deeper descendants
- The server GraphQL type and Zod schema still use the old `descendantSortCodes` shape

---

## Progress Snapshot

```text
Chunk A  Backend schema + Zod + migration helper + tests                NOT STARTED
Chunk B  Client CustomData + predicates                                  DONE (dynamic-report-2/types.ts)
Chunk C  buildInitialBankTree pure function + tests                      NOT STARTED
Chunk D  buildReportTree pure function + tests                           NOT STARTED
Chunk E  Client-side legacy migration helper + tests                     NOT STARTED
Chunk F  Split bank/report state + two-panel layout                      DONE
Chunk G  Cross-tree single-presence drop handler + tests                 PARTIAL (wiring in index.tsx exists, but cross-tree-drop.ts is missing)
Chunk H  Edit mode + dirty state + confirmation dialog                   PARTIAL (toggle + badge done; template-switch guard missing)
Chunk I  Node rendering nodeType-aware + edit-mode prop                  DONE
Chunk J  canDrop guard (no make-child into entity leaf)                  PARTIAL (blocked at node level in tree-node.tsx, no function-level tests)
Chunk K  Delete branch → move whole subtree to bank root                 PARTIAL (only direct children rerooted)
Chunk L  Template management UI (save-as, resave, rename, duplicate)     PARTIAL (UI complete, all mutations stubbed)
Chunk M  Legacy template detection banner                                DONE (UI wired with mock isLegacy flag)
Chunk N  Integration + URL filters + locked-template guard               PARTIAL (filter state is useState, no URL params; locked guard missing)
Chunk O  CSV export report tree only                                     NOT STARTED
```

---

## High-Level Blueprint

### Phase 1 — Backend contract

Update the server GraphQL type and Zod schema to the new explicit-node format, add the server-side
legacy migration helper, regenerate types. **This must happen before any chunk that touches live
GraphQL data (Chunks 4, 5, 6, 7).**

### Phase 2 — Stabilize dynamic-report-2 runtime

Fix the three known baseline gaps (missing `cross-tree-drop.ts`, missing `hebrewText`, broken delete
subtree behavior) so the component builds and behaves correctly on mock data.

### Phase 3 — Pure data builders

Add `buildInitialBankTree` and `buildReportTree` as pure, tested functions before wiring any live
data. The client-side legacy-migration helper also belongs here.

### Phase 4 — Live data integration

Replace mock state with live GraphQL queries. Reset bank to initial state on template load. Switch
leaf expanded view from mock records to `BusinessExtendedInfo`.

### Phase 5 — Template lifecycle

Add dirty-state guard before template switching, serialization helper, and persist all template
operations via real GraphQL mutations.

### Phase 6 — Hardening

Enforce locked-template rules, restore URL filter persistence, implement CSV export.

---

## Iterative Chunks

```text
Chunk 0  Backend: update GraphQL type + Zod schema + isLegacyTemplate/migrateLegacyTemplate + codegen + tests
         (prerequisite for all live-data chunks; can be done in parallel with Chunks 1–3)

Chunk 1  Fix baseline: add hebrewText to CustomData; implement cross-tree-drop.ts
         (same-tree reorder + cross-tree move; single-presence rule; canDrop guard) + tests

Chunk 2  Fix delete branch: move whole subtree intact to bank root (report); remove subtree (bank)
         + tests

Chunk 3  buildInitialBankTree(sortCodes, businessSums, excludedIds, includeZeroed) + tests
         (depends on: Chunk 0 codegen output for GraphQL types)

Chunk 4  buildReportTree(templateNodes, businessSums) → { reportTree, placedEntityIds } + tests
         (depends on: Chunk 0)

Chunk 5  Client legacy-migration helper:
         isLegacyTemplateNodes(), migrateLegacyTemplateNodes(nodes, businessSums) + tests

Chunk 6  Replace mock data in index.tsx with live GraphQL data:
         - allSortCodes + businessTransactionsSumFromLedgerRecords queries
         - buildReportTree (if template loaded) → setBankTree(buildInitialBankTree(...excludedIds))
         - bank resets to initial state on every template load
         - leaf expanded view: replace generateMockLedgerRecords with BusinessExtendedInfo
         (depends on: Chunks 3, 4, 5)

Chunk 7  Dirty confirmation dialog when switching templates
         (depends on: Chunk 6 — needs live template load flow)

Chunk 8  serializeReportTree helper: report nodes only; strip runtime fields (value, entityType)
         + tests
         (depends on: Chunk 6 — reportTree is now live data)

Chunk 9  Wire template mutations: insertDynamicReportTemplate (save-as),
         updateDynamicReportTemplate (resave), updateDynamicReportTemplateName (rename),
         duplicate (insert copy), deleteDynamicReportTemplate (delete)
         — each with isDirty reset and error handling
         (depends on: Chunk 8)

Chunk 10 Locked-template enforcement: hide edit-mode toggle when template.isLocked; disable
         resave/rename/delete in toolbar and TemplateManager; duplicate allowed regardless
         (depends on: Chunk 9)

Chunk 11 URL filter persistence: sync fromDate, toDate, selectedOwner, showZeroed with
         URL search params using useSearchParams

Chunk 12 CSV export: generate and download CSV from reportTree only (bank excluded)

Chunk 13 End-to-end cleanup: remove all mock-data imports from index.tsx; confirm
         yarn workspace @accounter/client test --run passes; confirm yarn lint passes
```

---

## LLM Prompts

---

### Prompt 0 — Backend: GraphQL type + Zod schema + legacy migration helper + tests

```text
We are working in: packages/server/src/modules/reports/

## Context

The existing `DynamicReportNodeData` GraphQL type
(packages/server/src/modules/reports/typeDefs/dynamic-report.graphql.ts) still has:

  type DynamicReportNodeData {
    descendantSortCodes: [Int!]
    descendantFinancialEntities: [UUID!]
    mergedSortCodes: [Int!]
    isOpen: Boolean!
    hebrewText: String
  }

The Zod schema in packages/server/src/modules/reports/helpers/dynamic-report.helper.ts mirrors
these fields.

## Task

### 1. Update the GraphQL type

Replace DynamicReportNodeData with:

  type DynamicReportNodeData {
    nodeType: String!
    isOpen: Boolean!
    hebrewText: String
  }

### 2. Update the Zod schema

Replace the dynamicReportNodeData Zod object with:

  const dynamicReportNodeData = z
    .object({
      nodeType: z.enum(['synthetic-branch', 'sort-code-branch', 'financial-entity']),
      isOpen: z.boolean(),
      hebrewText: z.string().optional(),
    })
    .strict()

Keep parseTemplate, validateTemplate, DynamicReportNodeType, DynamicReportNodeDataType.

### 3. Add isLegacyTemplate and migrateLegacyTemplate

Export from dynamic-report.helper.ts:

  export function isLegacyTemplate(nodes: unknown[]): boolean
  // Returns true when any node's data has a 'descendantSortCodes' key.

  export function migrateLegacyTemplate(
    nodes: LegacyDynamicReportNode[],
    entityBySortCode: Map<string | number, string[]>,
  ): DynamicReportNodeType[]
  // Converts implicit-membership format to explicit-leaf format.

For migrateLegacyTemplate:
- Branch nodes (droppable === true): keep id, parent, text, droppable; map data to new shape
  - no sortCode in old data → nodeType: 'synthetic-branch'
  - sortCode present → nodeType: 'sort-code-branch'
  - strip descendantSortCodes, descendantFinancialEntities, mergedSortCodes
- For each UUID in descendantFinancialEntities on a branch, unless already an explicit leaf,
  insert: { id: uuid, parent: branchId, text: uuid, droppable: false,
            data: { nodeType: 'financial-entity', isOpen: false } }
- Add internal type LegacyDynamicReportNode (not exported) matching the old Zod shape.

### 4. Run codegen

Run: yarn workspace @accounter/server generate

Confirm no TypeScript errors in the helper file.

### 5. Unit tests

Create packages/server/src/modules/reports/helpers/__tests__/dynamic-report.helper.test.ts.
Use vitest, import from '../dynamic-report.helper.js'.

Required test cases:
- parseTemplate succeeds with valid new-format JSON (nodeType present)
- parseTemplate throws on JSON missing nodeType
- isLegacyTemplate returns true when any node.data has descendantSortCodes
- isLegacyTemplate returns false when no node has that key
- migrateLegacyTemplate: one sort-code branch + two UUIDs in descendantFinancialEntities
    → branch has nodeType 'sort-code-branch'; two explicit leaf nodes with parent = branchId
- migrateLegacyTemplate: leaf already explicit → not duplicated
- migrateLegacyTemplate: branch without sortCode → nodeType 'synthetic-branch'

Run: yarn workspace @accounter/server test --run
```

---

### Prompt 1 — Fix CustomData baseline + implement cross-tree-drop.ts + tests

```text
We are working in: packages/client/src/components/reports/dynamic-report-2/

## Prerequisites

Add hebrewText to CustomData in types.ts:

  export type CustomData = {
    nodeType: NodeType;
    hebrewText?: string;          // ← add this
    value?: number | null;
    sortCode?: number | null;
    isOpen: boolean;
    entityType?: 'business' | 'person';
  };

## Task

Create cross-tree-drop.ts and export:

  export type DragPayload = { nodeId: string; sourceTreeId: 'bank' | 'report' };

  export function handleCrossTreeDrop(
    bankTree: FlatNode<CustomData>[],
    reportTree: FlatNode<CustomData>[],
    payload: DragPayload,
    targetNodeId: string,
    targetTreeId: 'bank' | 'report',
    instruction: Instruction | null,
  ): { nextBankTree: FlatNode<CustomData>[]; nextReportTree: FlatNode<CustomData>[] }

Import Instruction from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item'.
Import getDescendantIds from './types.js'.

Algorithm:

1. sourceTree = bankTree when payload.sourceTreeId === 'bank', else reportTree.
2. movedIds = [payload.nodeId, ...getDescendantIds(sourceTree, payload.nodeId)].
3. Remove movedIds from sourceTree → nextSourceTree.
4. Apply instruction to targetTree:
   a. null / panel root drop (targetNodeId === 'bank' | 'report'):
      append moved nodes to end; set dragged node parent = targetTreeId.
   b. reorder-above: insert moved group immediately before targetNodeId in flat array;
      set dragged node parent = targetNode.parent (or targetTreeId if crossing trees).
   c. reorder-below: insert moved group immediately after targetNodeId.
   d. make-child: set dragged node parent = targetNodeId; append after last existing child.
   e. reparent: walk ancestors of targetNodeId by instruction.desiredLevel to find new parent.
5. Guards (return unchanged trees):
   - targetNodeId === payload.nodeId (dragging onto itself)
   - instruction.type === 'make-child' and target node is a financial-entity leaf

Note: same-tree reorder (sourceTreeId === targetTreeId) is handled by the same function —
the source and target are the same array; remove moved nodes then reinsert at new position.

## Tests

Create __tests__/cross-tree-drop.test.ts. Use vitest.

Required test cases:
- Leaf dragged bank → report (null instruction): absent from bank, present in report at root
- Branch + 2 children dragged report → bank (null): all 3 absent from report, present in bank
- Same-tree reorder (reorder-above): node moves to correct position, other tree unchanged
- make-child instruction: dragged node parent set to targetNodeId
- Drag onto self: trees unchanged
- make-child onto financial-entity leaf: trees unchanged (guard fires)
- reparent instruction: dragged node parent updated to ancestor at desiredLevel

Run: yarn workspace @accounter/client test --run
```

---

### Prompt 2 — Fix delete branch: move whole subtree to bank root + tests

```text
We are working in: packages/client/src/components/reports/dynamic-report-2/index.tsx

## Context

Current handleDeleteConfirm rereroots only direct children:
  const directChildren = allNodes.filter(n => n.parent === deleteNodeId);
This silently drops all deeper descendants.

## Task

Replace handleDeleteConfirm with correct behavior using getDescendantIds from './types.js':

When deleting a branch from the REPORT tree:
  1. Collect subtreeIds = [deleteNodeId, ...getDescendantIds(reportTree, deleteNodeId)]
  2. Extract those nodes from reportTree
  3. Set the root branch node parent to 'bank'
  4. Preserve all internal parent links (children still point to the branch)
  5. Append the full set to bankTree
  6. Remove the set from reportTree

When deleting a branch from the BANK tree:
  1. Collect subtreeIds = [deleteNodeId, ...getDescendantIds(bankTree, deleteNodeId)]
  2. Remove all those nodes from bankTree

When deleting a leaf (droppable === false):
  Remove only that leaf from whichever tree contains it.

The dialog text should differ:
- Report branch: "This branch and all its contents will be moved to the bank."
- Bank branch: "This branch and all its contents will be permanently deleted."

To know which tree a node belongs to, check bankTree.some(n => n.id === deleteNodeId).

## Tests

Create __tests__/delete-branch.test.ts. Import handleDeleteConfirm logic by extracting it
into a pure function moveBranchToBank(reportTree, bankTree, nodeId) in a new file
move-branch-to-bank.ts, then test that file.

Required test cases:
- Branch with 2 children + 1 grandchild deleted from report:
    all 4 nodes absent from report; all 4 present in bank; branch parent is 'bank';
    children and grandchild retain their original parents
- Total node count (bank + report) is unchanged after the move
- Branch deleted from bank: branch and all descendants absent; no change to report
- Leaf deleted: only that leaf removed

Run: yarn workspace @accounter/client test --run
```

---

### Prompt 3 — buildInitialBankTree pure function + tests

```text
We are working in: packages/client/src/components/reports/dynamic-report-2/

Prerequisite: Prompt 0 (codegen) must have run so GraphQL types include nodeType.

## Task

Create bank-tree.ts:

  import type { AllSortCodesQuery, DynamicReportQuery } from '../../../gql/graphql.js'
  import type { CustomData, FlatNode } from './types.js'

  export const BANK_ROOT = 'bank'

  type BusinessSum = Extract<
    NonNullable<DynamicReportQuery['businessTransactionsSumFromLedgerRecords']>,
    { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
  >['businessTransactionsSum'][number]

  export function buildInitialBankTree(
    sortCodes: AllSortCodesQuery['allSortCodes'],
    businessSums: BusinessSum[],
    excludedIds: Set<string>,
    includeZeroed: boolean,
  ): FlatNode<CustomData>[]

Rules:
- Filter out entities in excludedIds.
- If !includeZeroed, filter out entities where total.raw === 0.
- Sort-code branch nodes:
    id = sortCode.id (string), parent = BANK_ROOT, droppable = true,
    text = `${sortCode.key} — ${sortCode.name}`,
    data = { nodeType: 'sort-code-branch', sortCode: sortCode.key, isOpen: false }
- Only emit a sort-code branch if it has at least one visible entity after filtering.
- Sort-code branches ordered ascending by sortCode.key.
- Entity leaf nodes:
    id = business.id, parent = sortCode branch id (or BANK_ROOT if no sortCode),
    droppable = false, text = business.name,
    data = { nodeType: 'financial-entity', value: total.raw * -1, isOpen: false }
- Entities with no sort code appear after all sort-code branches, sorted alphabetically by name.

## Tests

Create __tests__/bank-tree.test.ts. Use vitest.

Required test cases:
- Empty inputs → empty array
- 2 sort codes, 3 entities: correct parent assignment; sort-code branches in ascending key order
- Entity with no sort code: parent is BANK_ROOT; appears after sort-code branches
- Multiple no-sort-code entities: sorted alphabetically among themselves
- Entity in excludedIds: absent; its sort-code branch omitted if it would be empty
- includeZeroed = false: entity with total.raw = 0 excluded
- includeZeroed = true: same entity included
- value on leaf = total.raw * -1

Run: yarn workspace @accounter/client test --run
```

---

### Prompt 4 — buildReportTree pure function + tests

```text
We are working in: packages/client/src/components/reports/dynamic-report-2/

## Task

Create report-tree.ts:

  import type { DynamicReportQuery } from '../../../gql/graphql.js'
  import type { CustomData, FlatNode } from './types.js'

  export const REPORT_ROOT = 'report'

  type TemplateNode = {
    id: string | number
    parent: string | number
    text: string
    droppable: boolean
    data: {
      nodeType: string
      isOpen: boolean
      hebrewText?: string
      sortCode?: number | null
    }
  }

  type BusinessSum = Extract<
    NonNullable<DynamicReportQuery['businessTransactionsSumFromLedgerRecords']>,
    { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
  >['businessTransactionsSum'][number]

  export function buildReportTree(
    templateNodes: TemplateNode[],
    businessSums: BusinessSum[],
  ): { reportTree: FlatNode<CustomData>[]; placedEntityIds: Set<string> }

Rules:
- Replace parent: 0 (old root sentinel) with REPORT_ROOT.
- For entity leaf nodes: hydrate text (name) and data.value from businessSums by id.
  If the entity is not in businessSums (deleted/merged), silently drop the node.
- For branch nodes: preserve id, parent, text, droppable, data as-is.
  If nodeType is 'sort-code-branch' and id is numeric, set data.sortCode = Number(id).
- placedEntityIds: Set of all entity leaf ids that were successfully placed.

## Tests

Create __tests__/report-tree.test.ts. Use vitest.

Required test cases:
- Empty template → empty reportTree, empty placedEntityIds
- 1 synthetic branch + 2 entity leaves both in businessSums:
    both hydrated (text = name, value set); placedEntityIds has both
- 1 entity in template NOT in businessSums → that leaf dropped; placedEntityIds has only survivor
- sort-code-branch node with numeric id → data.sortCode is set
- parent: 0 → replaced with REPORT_ROOT
- Nested branches: parent IDs preserved exactly

Run: yarn workspace @accounter/client test --run
```

---

### Prompt 5 — Client legacy-migration helper + tests

```text
We are working in: packages/client/src/components/reports/dynamic-report-2/

## Context

Old templates have descendantFinancialEntities arrays on branch nodes. The new format stores
entities as explicit leaf nodes. When a legacy template is detected, migrate it in-memory.

## Task

Create legacy-migration.ts:

  import type { DynamicReportQuery } from '../../../gql/graphql.js'
  import { REPORT_ROOT } from './report-tree.js'
  import type { CustomData, FlatNode } from './types.js'

  export type LegacyTemplateNode = {
    id: string | number
    parent: string | number
    text: string
    droppable: boolean
    data: {
      isOpen: boolean
      hebrewText?: string
      sortCode?: number | null
      descendantFinancialEntities?: string[] | null
      descendantSortCodes?: number[] | null
      mergedSortCodes?: number[] | null
    }
  }

  type BusinessSum = Extract<...>['businessTransactionsSum'][number]  // same as report-tree.ts

  export function isLegacyTemplateNodes(nodes: LegacyTemplateNode[]): boolean
  // Returns true when any node.data has descendantSortCodes key.

  export function migrateLegacyTemplateNodes(
    nodes: LegacyTemplateNode[],
    businessSums: BusinessSum[],
  ): FlatNode<CustomData>[]

Rules for migration:
- Branch nodes: map to new FlatNode; nodeType based on presence of sortCode in data.
- Replace parent: 0 with REPORT_ROOT.
- For each UUID in descendantFinancialEntities, if not already an explicit leaf:
    look up in businessSums for name + value; if not found, drop silently.
    Insert leaf: { id: uuid, parent: branchId, text: name, droppable: false,
                   data: { nodeType: 'financial-entity', value, isOpen: false } }
- Strip descendantSortCodes, descendantFinancialEntities, mergedSortCodes from output.

## Tests

Create __tests__/legacy-migration.test.ts. Use vitest.

Required test cases:
- isLegacyTemplateNodes: true when any node has descendantSortCodes
- isLegacyTemplateNodes: false for new-format nodes
- Migration: sort-code branch + 2 UUIDs in descendantFinancialEntities, both in businessSums
    → branch (nodeType 'sort-code-branch', no hint arrays) + 2 explicit leaves
- Migration: UUID in descendantFinancialEntities but NOT in businessSums → leaf silently dropped
- Migration: synthetic branch (no sortCode) → nodeType 'synthetic-branch'
- Migration: parent: 0 → parent becomes REPORT_ROOT

Run: yarn workspace @accounter/client test --run
```

---

### Prompt 6 — Live data wiring in index.tsx + BusinessExtendedInfo leaf view

```text
We are working in: packages/client/src/components/reports/dynamic-report-2/

Prerequisite: Prompts 0 (codegen), 3, 4, 5 complete.

## Context

index.tsx currently initialises bankTree and reportTree from mockBankTree / mockReportTree.
The leaf expanded view in tree-node.tsx uses generateMockLedgerRecords.

## Task

### 1. Add GraphQL queries to index.tsx

Use the existing urql useQuery hooks for:
- allSortCodes query (already in the old dynamic-report/index.tsx for reference)
- businessTransactionsSumFromLedgerRecords query with fromDate, toDate, ownerId filters
- dynamic report templates list query (or reuse existing list query from the old component)

### 2. Replace mock state initialization

On mount and whenever query data changes:
  const { reportTree, placedEntityIds } = currentTemplate
    ? isLegacyTemplateNodes(currentTemplate.nodes)
        ? { reportTree: migrateLegacyTemplateNodes(currentTemplate.nodes, businessSums),
            placedEntityIds: new Set(leafIds from migrated tree) }
        : buildReportTree(currentTemplate.nodes, businessSums)
    : { reportTree: [], placedEntityIds: new Set() }

  const bankTree = buildInitialBankTree(sortCodes, businessSums, placedEntityIds, showZeroed)
  setBankTree(bankTree)
  setReportTree(reportTree)

On template load (handleLoadTemplate): reset bank to initial state using buildInitialBankTree.
Remove all references to mockBankTree and mockReportTree for runtime state.
mock-data.ts may remain for any remaining test/demo stubs but must not be used in useEffect.

### 3. Replace leaf expanded view

In tree-node.tsx, replace the mock ledger records section with BusinessExtendedInfo:
  import { BusinessExtendedInfo } from '../../business-ledger/business-extended-info.js'
  // Render when isLeaf && isExpanded:
  <BusinessExtendedInfo businessId={node.id} />
Remove the generateMockLedgerRecords import and the LedgerRecord table JSX.

Run: yarn workspace @accounter/client build (tsc --noEmit) — confirm zero errors.
```

---

### Prompt 7 — Template-switch dirty confirmation dialog

```text
We are working in: packages/client/src/components/reports/dynamic-report-2/

## Context

handleLoadTemplate in index.tsx currently loads any template without checking isDirty.
The spec requires a confirmation dialog when isDirty is true.

## Task

Add state:
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null)
  const [templateSwitchDialogOpen, setTemplateSwitchDialogOpen] = useState(false)

Replace handleLoadTemplate with:
  const handleLoadTemplate = useCallback((template: Template) => {
    if (isDirty) {
      setPendingTemplate(template)
      setTemplateSwitchDialogOpen(true)
    } else {
      applyTemplate(template)
    }
  }, [isDirty])

  const applyTemplate = useCallback((template: Template) => {
    // rebuild trees from template + live data (from Prompt 6)
    setCurrentTemplate(template)
    setShowLegacyBanner(isLegacyTemplateNodes(template.nodes))
    setIsDirty(false)
  }, [...])

Add a shadcn AlertDialog for confirmation:
- Title: "Unsaved changes"
- Description: "Loading a template will discard your unsaved changes. Continue?"
- Cancel: close dialog, keep current state
- Continue: call applyTemplate(pendingTemplate), close dialog
```

---

### Prompt 8 — serializeReportTree + tests

```text
We are working in: packages/client/src/components/reports/dynamic-report-2/

## Task

Create template-serialization.ts:

  import type { CustomData, FlatNode } from './types.js'
  import { REPORT_ROOT } from './report-tree.js'

  /**
   * Converts the in-memory reportTree to the JSON string stored in the DB.
   * Only report nodes (parent chain leads to REPORT_ROOT) are included.
   * Runtime fields (value, entityType) are stripped — only persisted fields are kept.
   */
  export function serializeReportTree(reportTree: FlatNode<CustomData>[]): string

Serialized node shape (matches DynamicReportNodeType on the server):
  {
    id: node.id,
    parent: node.parent,
    text: node.text,
    droppable: node.droppable,
    data: {
      nodeType: node.data.nodeType,
      isOpen: node.data.isOpen,
      ...(node.data.hebrewText ? { hebrewText: node.data.hebrewText } : {}),
      ...(node.data.sortCode != null ? { sortCode: node.data.sortCode } : {}),
      // value and entityType intentionally excluded
    }
  }

## Tests

Create __tests__/template-serialization.test.ts. Use vitest.

Required test cases:
- Output is valid JSON parseable by JSON.parse
- value field absent from serialized entity nodes
- entityType field absent
- hebrewText present when set, absent when not set
- Bank nodes (parent = 'bank') must not appear in output — only report subtree
- isOpen, nodeType, sortCode are preserved

Run: yarn workspace @accounter/client test --run
```

---

### Prompt 9 — Wire template mutations

```text
We are working in: packages/client/src/components/reports/dynamic-report-2/

Prerequisite: Prompt 8 complete.

## Task

In index.tsx, replace all stub handlers with real GraphQL mutations.
Import the existing mutation hooks from the old dynamic-report implementation for reference.
The mutations are:
  - insertDynamicReportTemplate → save-as (onSaveAsNew)
  - updateDynamicReportTemplate → resave (onResave)
  - updateDynamicReportTemplateName → rename (onRename)
  - deleteDynamicReportTemplate → delete (onDelete)
  - Duplicate = insertDynamicReportTemplate with pre-filled name "Copy of <name>"

For each:
- Call serializeReportTree(reportTree) to get the template string.
- On success: set isDirty = false; update currentTemplate name/id as appropriate.
- On error: show a toast/error state.

In TemplateManager (template-manager.tsx):
- Add a Rename column action that triggers an inline rename input and calls
  updateDynamicReportTemplateName on submit.
- Duplicate action already present — wire to insertDynamicReportTemplate.

Keep Rename in the toolbar dropdown for the currently loaded template.
```

---

### Prompt 10 — Locked-template enforcement

```text
We are working in: packages/client/src/components/reports/dynamic-report-2/

## Context

Spec rules for locked templates:
- Edit mode toggle disabled/hidden
- Resave, rename, delete disabled
- Duplicate allowed

## Task

In Toolbar:
- Pass isLocked: boolean prop (currentTemplate?.isLocked ?? false).
- When isLocked, hide (or disable) the Edit Mode switch.
- In the dropdown, disable Resave, Rename, Delete when isLocked; keep Duplicate enabled.

In TemplateManager:
- The Load button is already disabled for locked templates.
- Disable the Delete action for locked templates (already done).
- Keep Duplicate enabled regardless of locked state.

In index.tsx:
- When a locked template is loaded via applyTemplate, set editMode = false.
- Prevent editMode from being toggled back to true while a locked template is loaded.
```

---

### Prompt 11 — URL filter persistence

```text
We are working in: packages/client/src/components/reports/dynamic-report-2/index.tsx

Replace the four useState hooks for filters with URL search params:

  const [searchParams, setSearchParams] = useSearchParams()

  const fromDate = searchParams.get('from') ?? defaultFromDate
  const toDate = searchParams.get('to') ?? defaultToDate
  const selectedOwner = searchParams.get('owner') ?? ''
  const showZeroed = searchParams.get('zeroed') === '1'

  const setFromDate = (v: string) => setSearchParams(p => { p.set('from', v); return p })
  // ... etc for each filter

Defaults: fromDate = first day of current year, toDate = today.
Do NOT use useEffect for syncing — derive state directly from searchParams.
```

---

### Prompt 12 — CSV export (report tree only)

```text
We are working in: packages/client/src/components/reports/dynamic-report-2/index.tsx

Implement handleDownloadCSV:
- Traverse reportTree in display order (same render order as renderSubtree in tree-panel.tsx).
- For each financial-entity leaf, emit one row: Name, Value (ILS), depth level.
- For each branch, emit a header row with its name and total sum.
- Generate a CSV string and trigger a browser download via a Blob + URL.createObjectURL.
- File name: dynamic-report-<fromDate>-<toDate>.csv

Bank nodes are not included.
```

---

## Definition of Done

- Component builds with zero TypeScript errors: `yarn workspace @accounter/client build`
- No `mock-data.ts` imports remain in `index.tsx` at runtime
- All drop scenarios from the single-presence rule table in the spec work correctly
- Delete branch moves whole subtree (not just direct children) to bank root
- Legacy templates auto-migrate in-memory and show resave banner until saved
- Template-switch confirmation dialog shown when `isDirty`
- All template operations (save-as, resave, rename, duplicate, delete) call real mutations
- Locked templates: edit mode toggle hidden, resave/rename/delete disabled, duplicate enabled
- URL query params persist all four filter values across page reloads
- CSV export contains only report tree nodes
- All added unit tests pass: `yarn workspace @accounter/client test --run`
- Server tests pass: `yarn workspace @accounter/server test --run`
- `yarn lint` passes
