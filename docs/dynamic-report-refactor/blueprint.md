# Dynamic Report Refactor — Implementation Blueprint & LLM Prompts

## High-Level Blueprint

### Phase 1 — Backend contract

Update the server-side GraphQL type and Zod validation schema to match the new explicit-node format,
add the in-memory legacy-migration helper, then regenerate types.

### Phase 2 — Client types & pure utilities

Update the client-side `CustomData` type and extract the tree-building logic (bank tree, report
tree) into pure, testable functions before any UI work starts.

### Phase 3 — Legacy migration (client)

Write a client-side helper that detects the old template format and converts it into the new
explicit-leaf format using live entity data.

### Phase 4 — Split state + two-panel layout

Replace the single combined tree with two separate state slices (`bankTree` / `reportTree`) and
render them side-by-side, initially without cross-tree drag.

### Phase 5 — Single-presence drop handler

Implement the cross-tree drop logic that enforces "entity exists in exactly one place" including
whole-branch moves.

### Phase 6 — Edit mode + dirty state

Add the edit-mode toggle, dirty-state tracking, unsaved-changes indicator, and the confirmation
dialog that guards template switches.

### Phase 7 — Node rendering (nodeType-aware)

Update `CustomNode` to branch on `nodeType`, show edit controls only in edit mode, and pass the
edit-mode prop through the tree.

### Phase 8 — Cross-tree `canDrop` rules

Tighten the `canDrop` predicate: no dropping a branch inside a financial-entity leaf, etc.

### Phase 9 — Delete branch → move to bank

Swap the current "delete removes nodes" behaviour for "delete moves branch intact to bank root" with
a confirmation dialog.

### Phase 10 — Template management

Refactor the save/manage UX: save-as, resave, rename, duplicate, locked-template enforcement, and
the legacy-format prompt.

### Phase 11 — Integration pass & CSV

Wire all pieces in `index.tsx`, preserve filter/URL-param behaviour, confirm CSV export operates on
the report tree only.

---

## Iterative Chunks (right-sized)

```
Chunk A  Backend schema + Zod + migration helper + tests
Chunk B  Client CustomData type + node-type predicate utilities
Chunk C  buildInitialBankTree pure function + tests
Chunk D  buildReportTree pure function + tests
Chunk E  Client-side legacy-migration helper + tests
Chunk F  Split bank/report state + two-panel layout (no drag yet)
Chunk G  Cross-tree single-presence drop handler + tests
Chunk H  Edit mode + dirty state + confirmation dialog
Chunk I  CustomNode — nodeType-aware rendering + edit-mode prop
Chunk J  TreeView — cross-tree canDrop rules
Chunk K  Delete branch → confirmation + move-to-bank
Chunk L  Template management (save-as, resave, rename, duplicate)
Chunk M  Legacy template detection banner
Chunk N  Integration wiring (index.tsx) + filter persistence + locked-template guard
Chunk O  CSV export — report tree only
```

---

## LLM Prompts

---

### Prompt 1 — Backend: GraphQL schema + Zod schema + legacy migration helper

````text
We are working in the monorepo at `packages/server/src/modules/reports/`.

## Context

The existing `DynamicReportNodeData` GraphQL type (in
`packages/server/src/modules/reports/typeDefs/dynamic-report.graphql.ts`) is:

```graphql
type DynamicReportNodeData {
  descendantSortCodes: [Int!]
  descendantFinancialEntities: [UUID!]
  mergedSortCodes: [Int!]
  isOpen: Boolean!
  hebrewText: String
}
````

The existing Zod schema (in `packages/server/src/modules/reports/helpers/dynamic-report.helper.ts`)
mirrors these fields.

## Task

### 1. Update the GraphQL type

In `packages/server/src/modules/reports/typeDefs/dynamic-report.graphql.ts`, replace the
`DynamicReportNodeData` type with:

```graphql
type DynamicReportNodeData {
  nodeType: String!
  isOpen: Boolean!
  hebrewText: String
}
```

Remove the `descendantSortCodes`, `descendantFinancialEntities`, and `mergedSortCodes` fields
entirely.

### 2. Update the Zod schema

In `packages/server/src/modules/reports/helpers/dynamic-report.helper.ts`:

- Replace `dynamicReportNodeData` with a new Zod object that has:
  - `nodeType`: `z.enum(['synthetic-branch', 'sort-code-branch', 'financial-entity'])`
  - `isOpen`: `z.boolean()`
  - `hebrewText`: `z.string().optional()`
- Keep the `.strict()` modifier.
- Keep `parseTemplate`, `validateTemplate`, and the exported type aliases `DynamicReportNodeType`
  and `DynamicReportNodeDataType`.

### 3. Add a legacy format detector and migrator

Still in `dynamic-report.helper.ts`, export two new functions:

```typescript
/**
 * Returns true when the raw parsed node array contains at least one node
 * whose `data` object has a `descendantSortCodes` key — the hallmark of the
 * old implicit-membership format.
 */
export function isLegacyTemplate(nodes: unknown[]): boolean

/**
 * Converts a legacy template (implicit-membership format) to the new
 * explicit-leaf format given the set of live financial entity IDs that belong
 * to each sort code.
 *
 * @param nodes          Parsed legacy node array (validated against the old schema)
 * @param entityBySortCode  Map<sortCodeId, string[]> — entity UUIDs that belong to that sort code
 * @returns              Node array in the new explicit format (no hint arrays, explicit leaf nodes)
 */
export function migrateLegacyTemplate(
  nodes: LegacyDynamicReportNode[],
  entityBySortCode: Map<string | number, string[]>
): DynamicReportNodeType[]
```

For `migrateLegacyTemplate`:

- Copy all branch nodes (droppable === true) as-is, mapping `data` to new format:
  - Synthetic branches (no `sortCode` in old data): `nodeType: 'synthetic-branch'`
  - Sort-code branches (`sortCode` present in old data): `nodeType: 'sort-code-branch'`
  - Strip `descendantSortCodes`, `descendantFinancialEntities`, `mergedSortCodes`
- For every entity UUID in `descendantFinancialEntities` on each branch node, if the UUID is not
  already present as an explicit leaf, insert a leaf node:
  `{ id: uuid, parent: branchId, text: uuid, droppable: false, data: { nodeType: 'financial-entity', isOpen: false } }`
  (the caller will patch `text` to the entity name after loading — the UUID placeholder is fine for
  persistence purposes)
- Add a `LegacyDynamicReportNode` type (internal, not exported) that mirrors the old Zod shape so
  TypeScript is happy inside the function.

### 4. Write unit tests

Create `packages/server/src/modules/reports/helpers/__tests__/dynamic-report.helper.test.ts`.

Use `vitest`. Import from `../dynamic-report.helper.js`.

Test cases required:

- `parseTemplate` succeeds with a valid new-format JSON string
- `parseTemplate` throws on a JSON string missing `nodeType`
- `isLegacyTemplate` returns `true` for an array where at least one node's `data` has
  `descendantSortCodes`
- `isLegacyTemplate` returns `false` for an array where no node has that key
- `migrateLegacyTemplate` with a two-level legacy tree (one sort-code branch + two entities in
  `descendantFinancialEntities`) produces:
  - the branch node with `nodeType: 'sort-code-branch'`
  - two explicit leaf nodes with `nodeType: 'financial-entity'` and `parent` equal to the branch
    node's `id`
- `migrateLegacyTemplate` does not duplicate a leaf that already exists explicitly

After all changes run `yarn workspace @accounter/server generate` and confirm there are no
TypeScript errors in the helper file or its tests.

````

---

### Prompt 2 — Client: `CustomData` type + node-type predicate utilities

```text
We are working in:
  packages/client/src/components/reports/dynamic-report/types.ts

## Context

The current `CustomData` type is:
```typescript
export type CustomData = {
  hebrewText?: string;
  value?: number | null;
  sortCode?: number | null;
  isOpen: boolean;
  descendantSortCodes?: number[] | null;
  descendantFinancialEntities?: string[] | null;
  mergedSortCodes?: number[] | null;
};
````

The GraphQL schema now emits `nodeType: String!` on `DynamicReportNodeData` (updated in prompt 1).
The generated client types will include `nodeType`.

## Task

### 1. Replace `CustomData`

Replace the type entirely with:

```typescript
export type NodeType = 'synthetic-branch' | 'sort-code-branch' | 'financial-entity'

export type CustomData = {
  nodeType: NodeType
  hebrewText?: string
  /** Local-currency total; populated at runtime from ledger query, never stored */
  value?: number | null
  /** Numeric sort-code key; present on sort-code-branch nodes */
  sortCode?: number | null
  isOpen: boolean
}
```

### 2. Add predicate helpers (same file, exported)

```typescript
import type { NodeModel } from '@minoru/react-dnd-treeview'

export function isFinancialEntityNode(node: NodeModel<CustomData>): boolean {
  return node.data?.nodeType === 'financial-entity'
}

export function isSortCodeBranchNode(node: NodeModel<CustomData>): boolean {
  return node.data?.nodeType === 'sort-code-branch'
}

export function isSyntheticBranchNode(node: NodeModel<CustomData>): boolean {
  return node.data?.nodeType === 'synthetic-branch'
}

export function isBranchNode(node: NodeModel<CustomData>): boolean {
  return node.droppable === true
}
```

### 3. Fix immediately visible type errors

After changing `CustomData`, TypeScript will produce errors in:

- `custom-node.tsx` — references to `data?.sortCode`, `data?.value` etc. These are still valid
  fields, but `data?.descendantSortCodes` etc. must be removed. Remove any usage of the removed
  fields; keep `sortCode` and `value` access.
- `index.tsx` — same removals for the dropped fields.
- `dynamic-report-save-template.tsx` — the template serialisation references the old fields; remove
  `descendantSortCodes`, `descendantFinancialEntities`, `mergedSortCodes` from the serialised
  object.
- `tree-view.tsx` — references to `data?.sortCode` in the existing `handleDrop` / `canDrop` logic;
  update as needed to use the new predicates.

Do NOT restructure any component behaviour yet — only fix TypeScript errors caused by the type
change.

### 4. Verify

Run `yarn workspace @accounter/client build` (or `tsc --noEmit`) and confirm zero TypeScript errors
in all files under `packages/client/src/components/reports/dynamic-report/`.

````

---

### Prompt 3 — Bank tree builder (pure function + unit tests)

```text
We are working in the dynamic-report client component folder:
  packages/client/src/components/reports/dynamic-report/

## Context

The bank panel displays financial entities grouped by sort-code folders, with
independent entities (no sort code) listed alphabetically after the folders.
The bank state is never saved — it is always rebuilt fresh from live data.

The relevant GraphQL query types from `packages/client/src/gql/graphql.ts` are:
- `AllSortCodesQuery['allSortCodes']` — array of `{ id, key, name }`
- `BusinessTransactionsSumFromLedgerRecordsSuccessfulResult['businessTransactionsSum']`
  — array of `{ business: { id, name, sortCode: { id, key, name } | null }, total: { raw } }`

`NodeModel<CustomData>` is from `@minoru/react-dnd-treeview`.

## Task

### 1. Create `bank-tree.ts`

Create `packages/client/src/components/reports/dynamic-report/bank-tree.ts`.

Export one pure function:

```typescript
import type { NodeModel } from '@minoru/react-dnd-treeview';
import type { AllSortCodesQuery, DynamicReportQuery } from '../../../gql/graphql.js';
import type { CustomData } from './types.js';

export const BANK_TREE_ROOT_ID = 'bank';

type BusinessSum = Extract<
  NonNullable<DynamicReportQuery['businessTransactionsSumFromLedgerRecords']>,
  { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
>['businessTransactionsSum'][number];

/**
 * Builds the bank tree in its default / initial state.
 *
 * Rules:
 * - One sort-code-branch node per sort code, ordered ascending by sortCode.key
 * - Node id = sortCode.id, text = `${sortCode.key} — ${sortCode.name}`
 * - Financial entity nodes whose business.sortCode is non-null become children
 *   of the matching sort-code-branch node
 * - Financial entity nodes with no sort code are placed directly under BANK_TREE_ROOT_ID
 *   and sorted alphabetically by business.name
 * - Entities with |total.raw| < 0.005 are excluded unless includeZeroed is true
 * - value on each leaf = total.raw * -1
 *
 * @param sortCodes       All sort codes from AllSortCodesQuery
 * @param businessSums    Sum results from DynamicReport query
 * @param excludedIds     Set of entity IDs already placed in the report tree (excluded from bank)
 * @param includeZeroed   When true include entities whose |value| < 0.005
 */
export function buildInitialBankTree(
  sortCodes: AllSortCodesQuery['allSortCodes'],
  businessSums: BusinessSum[],
  excludedIds: ReadonlySet<string>,
  includeZeroed: boolean,
): NodeModel<CustomData>[]
````

Implementation notes:

- Sort-code branches:
  `{ id: sortCode.id, parent: BANK_TREE_ROOT_ID, droppable: true, text: \`${sortCode.key} —
  ${sortCode.name}\`, data: { nodeType: 'sort-code-branch', sortCode: sortCode.key, isOpen: false }
  }`
- Only include sort-code-branch nodes for sort codes that have at least one visible entity
  (otherwise bank is cluttered with empty folders).
- Financial entity leaves:
  `{ id: business.id, parent: sortCodeNodeId | BANK_TREE_ROOT_ID, droppable: false, text: business.name, data: { nodeType: 'financial-entity', value, isOpen: false } }`
- No sort-code branches are emitted for entities in `excludedIds`.
- Return value is a flat array (the tree library reconstructs the hierarchy).

### 2. Unit tests

Create `packages/client/src/components/reports/dynamic-report/__tests__/bank-tree.test.ts`.

Use `vitest`. Import from `../bank-tree.js`.

Required test cases:

- Empty inputs → returns empty array
- Two sort codes, three entities: correct parent assignment, sort-code-branch ids match sortCode.id,
  ascending sort-code order
- Entity with no sort code → parent is `BANK_TREE_ROOT_ID`, appears after all sort-code branches,
  sorted alphabetically when multiple independent entities exist
- Entity in `excludedIds` → not present in output (and its sort-code branch is omitted if it would
  be empty)
- `includeZeroed = false` → entity with `total.raw = 0` excluded
- `includeZeroed = true` → same entity included
- `value` on leaf equals `total.raw * -1`

Run `yarn workspace @accounter/client test --run` and confirm all tests pass.

````

---

### Prompt 4 — Report tree builder (pure function + unit tests)

```text
We are working in:
  packages/client/src/components/reports/dynamic-report/

## Context

When a template is loaded the report tree is reconstructed from:
1. The saved template nodes (branches + explicit entity-leaf nodes in new format)
2. Live `businessTransactionsSum` data (to hydrate `value` and `text` on entity leaves)

Entities referenced in the template that are NOT present in the live data are
omitted silently (they may have been deleted or have been merged).

Entities present in live data but NOT in the template remain in the bank (handled
by the bank tree builder via `excludedIds`).

## Task

### 1. Create `report-tree.ts`

Create `packages/client/src/components/reports/dynamic-report/report-tree.ts`.

```typescript
import type { NodeModel } from '@minoru/react-dnd-treeview';
import type { DynamicReportQuery } from '../../../gql/graphql.js';
import type { CustomData } from './types.js';

export const REPORT_TREE_ROOT_ID = 'report';

type TemplateNode = {
  id: string | number;
  parent: string | number;
  text: string;
  droppable: boolean;
  data: {
    nodeType: string;
    isOpen: boolean;
    hebrewText?: string | null;
  };
};

type BusinessSum = Extract<
  NonNullable<DynamicReportQuery['businessTransactionsSumFromLedgerRecords']>,
  { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
>['businessTransactionsSum'][number];

/**
 * Builds the report tree from a saved template and live entity data.
 *
 * Rules:
 * - Branch nodes (synthetic-branch, sort-code-branch) are copied from the template
 *   with their nesting and order preserved.
 * - Entity-leaf nodes are copied from the template; their `value` and `text` are
 *   patched from the matching entry in `businessSums` (matched by id).
 * - Entity leaves whose id is not found in `businessSums` are dropped (entity no
 *   longer exists).
 * - The `isOpen` state per node is taken from the template.
 *
 * @returns { reportTree, placedEntityIds }
 *   reportTree      — flat NodeModel array for the report panel
 *   placedEntityIds — Set<string> of entity UUIDs placed in the report tree
 *                     (so the bank builder can exclude them)
 */
export function buildReportTree(
  templateNodes: TemplateNode[],
  businessSums: BusinessSum[],
): { reportTree: NodeModel<CustomData>[]; placedEntityIds: Set<string> }
````

Implementation notes:

- Replace `parent: 0` (old root sentinel) with `REPORT_TREE_ROOT_ID` so the report-tree `rootId`
  prop is consistent.
- `sortCode` on branch nodes: if `nodeType === 'sort-code-branch'` and the template node id is a
  number, set `data.sortCode` to that id; otherwise leave undefined.

### 2. Unit tests

Create `packages/client/src/components/reports/dynamic-report/__tests__/report-tree.test.ts`.

Required test cases:

- Empty template → empty report tree, empty `placedEntityIds`
- Template with one synthetic branch + two entity leaves:
  - Both entity leaves present in `businessSums` → both appear with hydrated `value` and `text`,
    correct parent
  - `placedEntityIds` contains both entity UUIDs
- One of the entity leaves is NOT in `businessSums` → that leaf is dropped; `placedEntityIds`
  contains only the surviving entity
- Branch node with `nodeType: 'sort-code-branch'` → `data.sortCode` is set
- Template with nested branches → parent IDs are preserved exactly

Run `yarn workspace @accounter/client test --run` and confirm all tests pass.

````

---

### Prompt 5 — Client-side legacy template migration helper + tests

```text
We are working in:
  packages/client/src/components/reports/dynamic-report/

## Context

Old templates use `descendantFinancialEntities` arrays on branch nodes to
implicitly declare which entities belong there; entities are NOT stored as
explicit leaf nodes. The new format stores them as explicit leaf nodes.

When the server returns a template whose nodes contain `descendantFinancialEntities`,
the client must:
1. Detect the legacy format.
2. Migrate it in-memory to the new format (no DB write yet).
3. Show a banner prompting the user to resave.

The migration helper at the server level (`migrateLegacyTemplate`) is the
reference for the conversion algorithm. Here we need the client-side variant that
receives richer live data (business names + sort codes).

## Task

### 1. Create `legacy-migration.ts`

Create
`packages/client/src/components/reports/dynamic-report/legacy-migration.ts`.

```typescript
import type { NodeModel } from '@minoru/react-dnd-treeview';
import type { DynamicReportQuery } from '../../../gql/graphql.js';
import { REPORT_TREE_ROOT_ID } from './report-tree.js';
import type { CustomData } from './types.js';

/**
 * Raw node shape as returned by the GraphQL query for a legacy template.
 * (Old DynamicReportNodeData included the hint arrays.)
 */
export type LegacyTemplateNode = {
  id: string | number;
  parent: string | number;
  text: string;
  droppable: boolean;
  data: {
    isOpen: boolean;
    hebrewText?: string | null;
    sortCode?: number | null;
    descendantSortCodes?: number[] | null;
    descendantFinancialEntities?: string[] | null;
    mergedSortCodes?: number[] | null;
  };
};

type BusinessSum = Extract<
  NonNullable<DynamicReportQuery['businessTransactionsSumFromLedgerRecords']>,
  { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
>['businessTransactionsSum'][number];

/**
 * Returns true when the node array is in the legacy implicit-membership format.
 * Detection: any node whose `data` has a `descendantFinancialEntities` key.
 */
export function isLegacyTemplateNodes(nodes: LegacyTemplateNode[]): boolean

/**
 * Converts a legacy template node array to the new explicit-leaf format.
 *
 * Algorithm:
 * 1. Copy all branch nodes, assigning nodeType:
 *    - `data.sortCode != null` → 'sort-code-branch'
 *    - otherwise               → 'synthetic-branch'
 *    Strip all hint array fields.
 * 2. For each branch node that had `descendantFinancialEntities`, create explicit
 *    leaf nodes for each UUID in that array if a matching entry exists in
 *    `businessSums`. Set `value` from businessSum.total.raw * -1 and `text`
 *    from businessSum.business.name.
 * 3. Nodes whose parent is 0 or the old implicit root get parent = REPORT_TREE_ROOT_ID.
 *
 * @param nodes        Legacy node array (from GraphQL response)
 * @param businessSums Live entity data to hydrate names + values
 */
export function migrateLegacyTemplateNodes(
  nodes: LegacyTemplateNode[],
  businessSums: BusinessSum[],
): NodeModel<CustomData>[]
````

### 2. Unit tests

Create `packages/client/src/components/reports/dynamic-report/__tests__/legacy-migration.test.ts`.

Required test cases:

- `isLegacyTemplateNodes` returns `true` for a node with `descendantFinancialEntities`
- `isLegacyTemplateNodes` returns `false` for new-format nodes (only `nodeType`)
- Migration of a legacy tree: one sort-code branch with two entity UUIDs in
  `descendantFinancialEntities` → output has the branch (nodeType='sort-code-branch', no hint
  arrays) + two explicit leaf nodes with correct parent, name, value
- Migration: entity UUID in `descendantFinancialEntities` but NOT in `businessSums` → that leaf is
  silently dropped
- Migration: synthetic branch (no `sortCode`) → `nodeType: 'synthetic-branch'`
- Migration: node with `parent: 0` → parent becomes `REPORT_TREE_ROOT_ID`

Run `yarn workspace @accounter/client test --run` and confirm all new tests pass.

````

---

### Prompt 6 — Split bank/report state + two-panel layout

```text
We are working in:
  packages/client/src/components/reports/dynamic-report/index.tsx

## Context

The current component stores a single `tree` state that holds both bank and report
nodes together, distinguished by their `parent` (BANK_TREE_ROOT_ID vs.
REPORT_TREE_ROOT_ID). We need to split this into two separate state slices and
render them side-by-side.

The pure helpers we now have:
- `buildInitialBankTree()` from `./bank-tree.js`  (BANK_TREE_ROOT_ID = 'bank')
- `buildReportTree()`      from `./report-tree.js` (REPORT_TREE_ROOT_ID = 'report')

## Task

### 1. Replace the single `tree` state

Replace:
```typescript
const [tree, setTree] = useState<NodeModel<CustomData>[]>([]);
````

with:

```typescript
const [bankTree, setBankTree] = useState<NodeModel<CustomData>[]>([])
const [reportTree, setReportTree] = useState<NodeModel<CustomData>[]>([])
```

### 2. Rebuild on data change

Add a `useMemo` / `useEffect` that recomputes `bankTree` whenever `sortCodes`,
`businessTransactionsSumData`, or `templateData` changes:

- If a template is loaded: call `buildReportTree(templateData.template, businessSums)` to produce
  `{ reportTree, placedEntityIds }`, then call
  `buildInitialBankTree(sortCodes, businessSums, placedEntityIds, isShowZeroedAccounts)` for the
  bank.
- If no template: call `buildInitialBankTree` with an empty `excludedIds` set, set `reportTree` to
  `[]`.

Keep the `isShowZeroedAccounts` state wired to the existing filter toggle.

### 3. Two-panel layout

Replace the existing single `<TreeView>` JSX with a two-column layout:

```tsx
<div className="grid grid-cols-2 gap-4 h-full">
  <div className="flex flex-col overflow-auto border rounded p-2">
    <h2 className="text-sm font-semibold mb-2">Bank</h2>
    <TreeView
      tree={bankTree}
      rootId={BANK_TREE_ROOT_ID}
      onDrop={handleBankDrop}
      editMode={editMode}
      handleTextChange={handleTextChange}
      handleIsOpenChange={handleIsOpenChange}
      handleDeleteCategory={handleDeleteCategory}
      filter={filter}
    />
  </div>
  <div className="flex flex-col overflow-auto border rounded p-2">
    <h2 className="text-sm font-semibold mb-2">Report</h2>
    <TreeView
      tree={reportTree}
      rootId={REPORT_TREE_ROOT_ID}
      onDrop={handleReportDrop}
      editMode={editMode}
      handleTextChange={handleTextChange}
      handleIsOpenChange={handleIsOpenChange}
      handleDeleteCategory={handleDeleteCategory}
      filter={filter}
    />
  </div>
</div>
```

For now use stub handlers that just call `setBankTree` / `setReportTree` with the new tree passed in
by the library (no cross-tree logic yet):

```typescript
const handleBankDrop = useCallback((newTree: NodeModel<CustomData>[]) => setBankTree(newTree), [])
const handleReportDrop = useCallback(
  (newTree: NodeModel<CustomData>[]) => setReportTree(newTree),
  []
)
```

### 4. Remove dead code

Remove `buildSortCodeFinancialEntitiesMaps`, `updateSortCodesTreeNodes`,
`updateFinancialEntitiesTreeNodes`, and the old `handleDrop` that operated on the unified `tree`
state.

### 5. Remove import of `REPORT_TREE_ROOT_ID` defined inline

`REPORT_TREE_ROOT_ID` and `BANK_TREE_ROOT_ID` are now exported from the utility modules — import
them from there.

### 6. Smoke test

Add a render test at
`packages/client/src/components/reports/dynamic-report/__tests__/index.test.tsx` using vitest +
@testing-library/react. Mock the urql `useQuery` hook to return empty results. Assert that two
headings "Bank" and "Report" are present in the rendered output.

Run `yarn workspace @accounter/client test --run` and confirm all tests pass.

````

---

### Prompt 7 — Cross-tree single-presence drop handler

```text
We are working in:
  packages/client/src/components/reports/dynamic-report/index.tsx
  packages/client/src/components/reports/dynamic-report/__tests__/index.test.tsx

## Context

After prompt 6 we have two separate tree states and stub drop handlers. Now we
need the real drop handlers that enforce the single-presence rule.

The rule: every entity exists in exactly one location at all times — the bank OR
the report tree, never both. The same applies to branches: dragging a branch moves
the branch AND all its descendants atomically.

`getDescendants(tree, nodeId)` from `@minoru/react-dnd-treeview` returns all
descendant `NodeModel` entries.

## Task

### 1. Extract `handleCrossTreeDrop` as a pure function

Create
`packages/client/src/components/reports/dynamic-report/cross-tree-drop.ts`.

```typescript
import { getDescendants, type NodeModel, type DropOptions } from '@minoru/react-dnd-treeview';
import type { CustomData } from './types.js';

/**
 * Handles a drop that may cross tree boundaries (bank ↔ report).
 *
 * @param sourceTree    The tree the drag originated from
 * @param targetTree    The tree the drop target belongs to
 * @param dropOptions   DropOptions from @minoru/react-dnd-treeview
 * @param newTargetTree The new target tree array emitted by the library's onDrop
 *
 * @returns { nextSourceTree, nextTargetTree }
 */
export function handleCrossTreeDrop(
  sourceTree: NodeModel<CustomData>[],
  targetTree: NodeModel<CustomData>[],
  dropOptions: DropOptions<CustomData>,
  newTargetTree: NodeModel<CustomData>[],
): { nextSourceTree: NodeModel<CustomData>[]; nextTargetTree: NodeModel<CustomData>[] }
````

Algorithm:

1. Collect the moved node IDs =
   `[dragSourceId, ...getDescendants(sourceTree, dragSourceId).map(n => n.id)]`
2. Remove those IDs from `sourceTree` → `nextSourceTree`
3. Use `newTargetTree` as `nextTargetTree` (the library already placed the node correctly)
4. If the drop was within the SAME tree (source and target are the same array reference), return
   `{ nextSourceTree: newTargetTree, nextTargetTree: newTargetTree }` (no cross-tree move needed).

### 2. Wire into index.tsx

Replace the stub handlers with:

```typescript
const handleBankDrop = useCallback(
  (newTree: NodeModel<CustomData>[], dropOptions: DropOptions<CustomData>) => {
    const { nextSourceTree, nextTargetTree } = handleCrossTreeDrop(
      reportTree,
      bankTree,
      dropOptions,
      newTree
    )
    setReportTree(nextSourceTree)
    setBankTree(nextTargetTree)
  },
  [bankTree, reportTree]
)

const handleReportDrop = useCallback(
  (newTree: NodeModel<CustomData>[], dropOptions: DropOptions<CustomData>) => {
    const { nextSourceTree, nextTargetTree } = handleCrossTreeDrop(
      bankTree,
      reportTree,
      dropOptions,
      newTree
    )
    setBankTree(nextSourceTree)
    setReportTree(nextTargetTree)
  },
  [bankTree, reportTree]
)
```

Note: `onDrop` in `@minoru/react-dnd-treeview` receives `(newTree, dropOptions)` — pass both. Update
the `TreeView` prop type for `onDrop` to match.

### 3. Unit tests

Create `packages/client/src/components/reports/dynamic-report/__tests__/cross-tree-drop.test.ts`.

Required test cases:

- Entity dragged from source tree to target tree → entity absent from source, present in target at
  drop position
- Branch with two children dragged across → branch + both children absent from source, present in
  target
- Same-tree reorder (sourceTree === targetTree, i.e. same array reference used for both arguments) →
  returns `newTargetTree` for both (no cross-tree deletion)

Run `yarn workspace @accounter/client test --run`.

````

---

### Prompt 8 — Edit mode, dirty state, and confirmation dialog

```text
We are working in:
  packages/client/src/components/reports/dynamic-report/index.tsx

## Context

We need:
1. An explicit edit-mode toggle that gates all structural changes.
2. A dirty-state flag set on every tree mutation.
3. A visual "Unsaved changes" indicator.
4. A confirmation dialog when the user tries to load a different template while dirty.

## Task

### 1. Add state

In `index.tsx`, add:
```typescript
const [editMode, setEditMode]   = useState(false);
const [isDirty,  setIsDirty]    = useState(false);
````

### 2. Mark dirty on every mutation

Wrap `setBankTree` and `setReportTree` in helper functions that also set `isDirty`:

```typescript
const updateBankTree = useCallback(
  (fn: (prev: NodeModel<CustomData>[]) => NodeModel<CustomData>[]) => {
    setBankTree(fn)
    setIsDirty(true)
  },
  []
)
const updateReportTree = useCallback(
  (fn: (prev: NodeModel<CustomData>[]) => NodeModel<CustomData>[]) => {
    setReportTree(fn)
    setIsDirty(true)
  },
  []
)
```

Use `updateBankTree` / `updateReportTree` everywhere a structural change occurs (drop handlers,
handleAddBankNode, handleTextChange, handleDeleteCategory).

Reset `isDirty` to `false` after a successful template save or when a template is freshly loaded.

### 3. Gate edit actions behind `editMode`

Pass `editMode` as a prop to both `TreeView` instances (replacing `enableDnd`). `canDrag` in
`TreeView` returns `false` when `editMode` is false (keep existing `canDrag={() => enableDnd}` but
rename `enableDnd` to `editMode` in props). The "Add new category" button in the footer should be
disabled/hidden when `!editMode`. Rename state/prop from `enableDnd` → `editMode` consistently.

### 4. Visual dirty indicator

In the footer context (the `setFiltersContext` call), add a `Badge` with text "Unsaved changes" when
`isDirty && !fetching`. Import `Badge` from `../../ui/badge.js`.

### 5. Confirmation dialog on template load

When the user selects a new template via `ManageTemplates`, check `isDirty`. If dirty, show a shadcn
`AlertDialog`:

- Title: "Unsaved changes"
- Description: "Loading a template will discard your unsaved changes. Continue?"
- Cancel button: dismiss without loading
- Continue button: load the template and reset `isDirty`

Implement this by adding an `onSelectTemplate` callback prop to `ManageTemplates` that `index.tsx`
provides. The component calls this prop when the user clicks a template row; `index.tsx` intercepts
it, checks dirty state, shows the dialog if needed, and proceeds to navigate when confirmed.

### 6. Smoke test additions

Extend the render test in `__tests__/index.test.tsx`:

- When `editMode` is false, the "Add new category" button is disabled.
- When `isDirty` is true, a "Unsaved changes" badge is present. (Simulate by triggering a drop via
  the drop handler and then checking the DOM.)

Run `yarn workspace @accounter/client test --run`.

````

---

### Prompt 9 — `CustomNode` nodeType-aware rendering + edit-mode prop

```text
We are working in:
  packages/client/src/components/reports/dynamic-report/custom-node.tsx

## Context

`CustomNode` currently renders identically for all nodes except a rough check
(`droppable && !sortCode`) to distinguish "synthetic categories". Now that every
node carries `data.nodeType`, we can branch precisely.

## Task

### 1. Add `editMode` prop

```typescript
type Props = {
  node: NodeModel<CustomData>;
  depth: number;
  isOpen: boolean;
  onToggle: (id: NodeModel['id']) => void;
  onTextChange: (id: NodeModel['id'], value: string) => void;
  onDeleteCategory: (id: NodeModel['id']) => void;
  descendants: NodeModel<CustomData>[];
  filter: DynamicReportFiltersType;
  editMode: boolean;       // ← new
};
````

### 2. Branch on `nodeType`

**`sort-code-branch` nodes**:

- Show toggle icon (open/close) and descendant count (unchanged)
- Show `<Badge variant="outline">Sort Code {data.sortCode}</Badge>` (unchanged)
- Show sum badge (unchanged)
- No rename or delete controls (sort-code branches are managed by data, not user)

**`synthetic-branch` nodes**:

- Show toggle icon, descendant count, sum badge (unchanged)
- Show rename inline input and delete dropdown item **only when `editMode` is true**
- When `editMode` is false, the rename input is hidden and the dropdown is not rendered

**`financial-entity` nodes** (`droppable === false`):

- Show leaf icon
- Show entity name and value badge
- Show expand/collapse for the ledger view (`BusinessExtendedInfo`) on click — this is independent
  of edit mode
- No rename or delete controls

### 3. Remove `isCategory` derivation

Remove `const isCategory = droppable && !props.node.data?.sortCode` and replace all usages with
`isSyntheticBranchNode(node)` from `./types.js`.

### 4. Pass `editMode` through `TreeView` → `CustomNode`

In `tree-view.tsx`:

- Add `editMode: boolean` to `Props`
- Pass it to `CustomNode` in the `render` callback

In `index.tsx`:

- Pass `editMode` to both `TreeView` instances

### 5. Render tests

Create `packages/client/src/components/reports/dynamic-report/__tests__/custom-node.test.tsx`.

Use vitest + @testing-library/react.

Required test cases (use `renderWithProviders` or a minimal wrapper with DndProvider):

- `sort-code-branch` node: rename input is NOT present regardless of `editMode`
- `synthetic-branch` node, `editMode=false`: rename and delete controls not present
- `synthetic-branch` node, `editMode=true`: rename input toggle visible, delete menu item visible
- `financial-entity` node: value badge present, no rename or delete

Run `yarn workspace @accounter/client test --run`.

````

---

### Prompt 10 — `TreeView` cross-tree `canDrop` rules

```text
We are working in:
  packages/client/src/components/reports/dynamic-report/tree-view.tsx

## Context

Currently `canDrop` only allows/prevents based on `editMode` and whether the
source is already a child of the target. We need richer rules that apply to both
the bank and report panels.

## Task

### 1. Add `treeId` prop

```typescript
type Props<T> = ... & {
  treeId: 'bank' | 'report';
  editMode: boolean;
};
````

### 2. Update `canDrop`

```typescript
canDrop={(_tree, { dragSource, dropTargetId, dropTarget }) => {
  if (!editMode) return false;

  // Cannot drop anything onto a financial-entity leaf
  if (dropTarget && isFinancialEntityNode(dropTarget)) return false;

  // Allow dropping onto the root of either tree
  if (dropTargetId === rootId) return true;

  // Within the same tree: allow reordering among siblings
  if (dragSource?.parent === dropTargetId) return true;

  return undefined; // let the library decide for other cases
}}
```

Import `isFinancialEntityNode` from `./types.js`.

### 3. Unit tests

Create `packages/client/src/components/reports/dynamic-report/__tests__/tree-view.test.tsx`.

Required test cases:

- `editMode=false` → `canDrop` returns false regardless of source/target
- Dropping onto a `financial-entity` node → returns false
- Dropping onto a branch node or root → returns true (when `editMode=true`)

Because `canDrop` is an internal prop passed to `Tree`, test the logic via the exported component:
simulate that the drop is blocked by asserting the resulting tree state does not change when
dropping on a financial-entity target.

Run `yarn workspace @accounter/client test --run`.

````

---

### Prompt 11 — Delete branch → confirmation dialog + move to bank

```text
We are working in:
  packages/client/src/components/reports/dynamic-report/index.tsx
  packages/client/src/components/reports/dynamic-report/custom-node.tsx

## Context

Currently `handleDeleteCategory` in `index.tsx` removes the branch and re-parents
its direct children to `BANK_TREE_ROOT_ID`. The spec requires:
- When a branch is deleted from the **report** tree, the entire branch
  (structure intact) moves to the bank tree root.
- A confirmation dialog is shown before the delete is executed.
- Deleting a branch from the **bank** tree removes it (with confirmation).

## Task

### 1. Create `move-branch-to-bank.ts`

Create
`packages/client/src/components/reports/dynamic-report/move-branch-to-bank.ts`.

```typescript
import { getDescendants, type NodeModel } from '@minoru/react-dnd-treeview';
import { BANK_TREE_ROOT_ID } from './bank-tree.js';
import type { CustomData } from './types.js';

/**
 * Removes `branchId` and all its descendants from `reportTree`,
 * and appends them to `bankTree` with the branch's parent set to
 * BANK_TREE_ROOT_ID (descendants retain their relative parents).
 */
export function moveBranchToBank(
  branchId: NodeModel['id'],
  reportTree: NodeModel<CustomData>[],
  bankTree:   NodeModel<CustomData>[],
): { nextReportTree: NodeModel<CustomData>[]; nextBankTree: NodeModel<CustomData>[] }
````

### 2. Update `handleDeleteCategory` in index.tsx

Replace the existing single-tree implementation:

```typescript
const handleDeleteCategory = useCallback((id: NodeModel['id'], treeSource: 'bank' | 'report') => {
  setPendingDelete({ id, treeSource })
  setDeleteConfirmOpen(true)
}, [])

const confirmDelete = useCallback(() => {
  if (!pendingDelete) return
  if (pendingDelete.treeSource === 'report') {
    const { nextReportTree, nextBankTree } = moveBranchToBank(
      pendingDelete.id,
      reportTree,
      bankTree
    )
    updateReportTree(() => nextReportTree)
    updateBankTree(() => nextBankTree)
  } else {
    // Delete from bank: remove branch + descendants entirely
    const ids = new Set([
      pendingDelete.id,
      ...getDescendants(bankTree, pendingDelete.id).map(n => n.id)
    ])
    updateBankTree(prev => prev.filter(n => !ids.has(n.id)))
  }
  setDeleteConfirmOpen(false)
  setPendingDelete(null)
}, [pendingDelete, reportTree, bankTree, updateReportTree, updateBankTree])
```

Add state: `const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);` Add state:
`const [pendingDelete, setPendingDelete] = useState<{ id: NodeModel['id']; treeSource: 'bank' | 'report' } | null>(null);`

Render a shadcn `AlertDialog` that is open when `deleteConfirmOpen`:

- Title: "Delete branch"
- Description: "This branch will be moved to the bank. Continue?" (for report) / "Delete this branch
  permanently?" (for bank)
- Cancel + Confirm buttons.

### 3. Thread `treeSource` through `TreeView` → `CustomNode`

Add a `treeSource: 'bank' | 'report'` prop to both `TreeView` and `CustomNode`. Pass it to the
`onDeleteCategory` callback.

### 4. Unit tests

Create
`packages/client/src/components/reports/dynamic-report/__tests__/move-branch-to-bank.test.ts`.

Required test cases:

- Branch with two entity children: after `moveBranchToBank`, branch and both children are absent
  from report tree, present in bank tree
- Branch root's parent in bank is `BANK_TREE_ROOT_ID`
- Children's parents are unchanged (still point to the branch id)
- Bank tree and report tree together still contain the same total count of nodes

Run `yarn workspace @accounter/client test --run`.

````

---

### Prompt 12 — Template management: save-as, resave, rename, duplicate

```text
We are working in:
  packages/client/src/components/reports/dynamic-report/dynamic-report-save-template.tsx
  packages/client/src/components/reports/dynamic-report/dynamic-report-manage-templates.tsx
  packages/client/src/components/reports/dynamic-report/index.tsx

## Context

### Current state
- `SaveTemplate` inserts a new template (save-as only).
- `ManageTemplates` lists templates with delete and unlock actions.

### Required additions
- **Resave**: overwrite the currently loaded template with the current report tree.
- **Rename**: rename the currently loaded template.
- **Duplicate**: save the current report tree as a new template (like save-as, but
  pre-fills a suggested name).

### Template serialisation rule
The saved template must contain **only report tree nodes** — bank tree nodes are
never saved.

Entity leaf nodes must include `nodeType: 'financial-entity'` and omit `value`
(a runtime-only field).

## Task

### 1. Extract `serializeReportTree` helper

Create `packages/client/src/components/reports/dynamic-report/template-serialization.ts`:

```typescript
import type { NodeModel } from '@minoru/react-dnd-treeview';
import type { CustomData } from './types.js';

/**
 * Converts the report tree state to the JSON string persisted in the DB.
 * - Strips `value` (runtime only)
 * - Includes `nodeType`, `isOpen`, `hebrewText`, `sortCode` in data
 * - Returns a JSON string
 */
export function serializeReportTree(reportTree: NodeModel<CustomData>[]): string
````

### 2. Update `SaveTemplate`

- Rename the internal `template` memo to use `serializeReportTree(reportTree)`.
- Accept `reportTree` as prop (instead of `tree`).
- Remove references to old serialization code that included bank-tree nodes.

### 3. Add Resave button

In `index.tsx`, add a "Resave" button to the footer that is only enabled when a `templateName` is
set and `isDirty` is true. On click it calls
`updateDynamicReportTemplate({ name: templateName, template: serializeReportTree(reportTree) })` via
the existing `useUpdateDynamicReportTemplate` hook, then sets `isDirty = false`.

### 4. Update `ManageTemplates`

In the per-row action dropdown in `dynamic-report-manage-templates.tsx`, add:

- **Rename**: opens an inline input in the row (or a modal) with the current name, calls
  `updateDynamicReportTemplateName({ name, newName })` on submit.
- **Duplicate**: triggers the save-as modal pre-filled with `"Copy of <name>"`.

For locked templates the only available action remains **duplicate** (not rename, delete, or edit).
Ensure locked rows disable the other actions.

### 5. Unit tests for serialization

Create
`packages/client/src/components/reports/dynamic-report/__tests__/template-serialization.test.ts`.

Required test cases:

- `serializeReportTree` output parses back to valid JSON
- Output does not contain any node whose `data.nodeType` is not one of the three valid values
- `value` field is absent from all serialized nodes
- `sortCode` field is present on nodes with `nodeType: 'sort-code-branch'`

Run `yarn workspace @accounter/client test --run`.

````

---

### Prompt 13 — Legacy template detection banner

```text
We are working in:
  packages/client/src/components/reports/dynamic-report/index.tsx

## Context

After prompt 5 we have `isLegacyTemplateNodes` and `migrateLegacyTemplateNodes`
from `./legacy-migration.js`. After prompt 6/7, when a template is loaded the
component calls `buildReportTree`. We need to intercept legacy templates before
`buildReportTree` and show a dismissible banner.

## Task

### 1. Detect and migrate on template load

In the `useEffect` / `useMemo` that processes `templateData`:
1. Check `isLegacyTemplateNodes(templateData.dynamicReport.template)`.
2. If legacy:
   a. Call `migrateLegacyTemplateNodes(templateData.dynamicReport.template, businessSums)`
      to get migrated nodes.
   b. Pass migrated nodes to `buildReportTree`.
   c. Set state `isLegacyTemplate = true`.
3. If not legacy:
   a. Pass nodes directly to `buildReportTree`.
   b. Set `isLegacyTemplate = false`.

Add state: `const [isLegacyTemplate, setIsLegacyTemplate] = useState(false);`

### 2. Banner

Render an `Alert` (variant `default`, using the `Info` icon from lucide-react)
below the toolbar and above the two-panel layout when `isLegacyTemplate` is true:

```tsx
{isLegacyTemplate && (
  <Alert className="mb-2">
    <Info className="h-4 w-4" />
    <AlertTitle>Legacy template format</AlertTitle>
    <AlertDescription>
      This template was saved in an older format and has been automatically
      migrated. Please resave to update it permanently.
    </AlertDescription>
  </Alert>
)}
````

The alert is dismissible by clicking the Resave button (which sets `isLegacyTemplate = false` after
a successful save).

### 3. Render test additions

Extend `__tests__/index.test.tsx`:

- When the template query returns a legacy node array (containing `descendantFinancialEntities`),
  the "Legacy template format" alert is present.
- When the template query returns a new-format node array, the alert is absent.

Run `yarn workspace @accounter/client test --run`.

````

---

### Prompt 14 — Integration wiring: filters, URL params, locked template, CSV

```text
We are working in:
  packages/client/src/components/reports/dynamic-report/index.tsx
  packages/client/src/components/reports/dynamic-report/download-csv.tsx

This is the integration pass — wiring all pieces together and ensuring no
regressions in the existing cross-cutting concerns.

## Task

### 1. Filters and URL params

Verify (and fix if broken) that:
- `fromDate`, `toDate`, `ownerIds` from the filter state are passed to
  `DynamicReportDocument` query variables (unchanged).
- `isShowZeroedAccounts` is passed to `buildInitialBankTree` as `includeZeroed`.
- On filter change the bank tree is rebuilt (via the dependency on
  `businessTransactionsSumData` in the `useEffect`).
- The filter state is read from and written to URL query params via `useUrlQuery`
  (unchanged from current implementation).

### 2. Locked template enforcement

When the loaded template has `isLocked === true` (from
`templateData.dynamicReport.isLocked`):
- Disable the edit-mode toggle (`<Switch disabled>` or hidden).
- Hide the Resave button.
- Disable Delete and Rename in `ManageTemplates` for that row.
- The only available template action is Duplicate.

Add a `isTemplateLocked` derived value:
```typescript
const isTemplateLocked = templateData?.dynamicReport?.isLocked ?? false;
````

Pass it to the edit-mode `<Switch>` as `disabled={isTemplateLocked}`. Pass it to `ManageTemplates`
as a `currentTemplateLocked` prop so it can disable actions for the currently-active row.

### 3. CSV export — report tree only

In `download-csv.tsx`, verify (or update) that the `tree` prop it receives is the `reportTree`
state, not the combined tree. In `index.tsx`, change the `DownloadCSV` usage to
`<DownloadCSV tree={reportTree} filters={filter} />`.

### 4. Reset dirty / isLegacyTemplate after save

After any successful mutation that saves the template (`insertDynamicReportTemplate`,
`updateDynamicReportTemplate`):

- Set `isDirty = false`
- Set `isLegacyTemplate = false`

### 5. AddBankNode restricted to bank

`handleAddBankNode` should only add a node to `bankTree`, not `reportTree`. Verify that the newly
created synthetic branch has `parent: BANK_TREE_ROOT_ID` and `data.nodeType: 'synthetic-branch'`.

### 6. Integration smoke test

Extend `__tests__/index.test.tsx`:

- Mock a locked template; assert the edit-mode switch is disabled.
- Assert the "Resave" button is absent when the template is locked.
- Assert `<DownloadCSV>` receives `reportTree` (check prop via a mock or by inspecting the rendered
  DOM for report-only node names).

Run `yarn workspace @accounter/client test --run` and `yarn lint` and confirm zero errors.

````

---

### Prompt 15 — Final: `yarn generate` + end-to-end type check + lint

```text
This is the final cleanup prompt. No new features — only verification and fixes.

## Task

### 1. Run codegen

```bash
yarn generate
````

This regenerates `packages/client/src/gql/graphql.ts` and server `__generated__/types` from the
updated GraphQL schema (prompt 1). Some generated types will change because `DynamicReportNodeData`
no longer has `descendantSortCodes` etc.

### 2. Fix generated-type usages

After codegen, the `TemplateForDynamicReport` query document in `index.tsx` will request fields that
no longer exist in the schema. Update the inline GraphQL query:

```graphql
query TemplateForDynamicReport($name: String!) {
  dynamicReport(name: $name) {
    id
    name
    isLocked
    template {
      id
      parent
      text
      droppable
      data {
        nodeType
        isOpen
        hebrewText
      }
    }
  }
}
```

Remove `descendantSortCodes`, `descendantFinancialEntities`, `mergedSortCodes` from this query
fragment.

For the legacy-migration path, the query that loads legacy templates must still request those fields
from the old GraphQL endpoint during the transition window. Since the server no longer exposes them,
the client-side legacy detection will simply never trigger for templates loaded after the schema
change; the only legacy templates will be those whose raw JSON string (in the DB) was saved in the
old format. The `isLegacyTemplateNodes` check operates on the raw template JSON returned as
`template` nodes — if the server parses with the new Zod schema it will strip old fields. To handle
this cleanly:

- Keep the server-side `parseTemplate` behind a try/catch that falls back to parsing with the old
  lenient schema (the legacy Zod shape without `.strict()` and with optional old fields). Return the
  parsed nodes verbatim so the client can detect and migrate.
- OR (simpler): store and return the raw template JSON as a plain string field `rawTemplate: String`
  alongside the structured `template: [DynamicReportNode]` field, and let the client parse + detect
  the legacy format from `rawTemplate`.

Choose the simpler option: add `rawTemplate: String` to `DynamicReportInfo` in the GraphQL typeDef,
resolve it by returning the raw DB string from the provider. The client uses `rawTemplate` only in
the legacy-detection path and the structured `template` field for the normal rendering path.

Update `TemplateForDynamicReport` query to also request `rawTemplate`. Update `DynamicReportInfo`
resolver to return `rawTemplate`.

### 3. Full type-check

```bash
yarn workspace @accounter/client tsc --noEmit
yarn workspace @accounter/server tsc --noEmit
```

Fix any remaining type errors.

### 4. Lint

```bash
yarn lint
```

Fix any ESLint warnings or errors.

### 5. Full test run

```bash
yarn test
```

All tests must pass.

```

---

## Summary of Prompt Ordering

| # | File(s) touched | What it tests |
|---|---|---|
| 1 | server typeDef, Zod helper | Server unit tests for parse/migrate |
| 2 | client `types.ts` | TypeScript compile check |
| 3 | `bank-tree.ts` | Pure-function unit tests |
| 4 | `report-tree.ts` | Pure-function unit tests |
| 5 | `legacy-migration.ts` | Pure-function unit tests |
| 6 | `index.tsx` split state | Render smoke test |
| 7 | `cross-tree-drop.ts` | Drop-handler unit tests |
| 8 | `index.tsx` edit/dirty | Render + interaction tests |
| 9 | `custom-node.tsx` | Node render tests |
| 10 | `tree-view.tsx` | `canDrop` logic tests |
| 11 | `move-branch-to-bank.ts`, `index.tsx` | Move-to-bank unit tests |
| 12 | save/manage templates | Serialization unit tests |
| 13 | `index.tsx` legacy banner | Render tests |
| 14 | `index.tsx` (integration) | Integration smoke tests |
| 15 | All (codegen + types) | Compile + lint + full test run |
```
