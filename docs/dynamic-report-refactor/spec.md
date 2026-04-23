# Dynamic Report Refactor — Specification

## Overview

Refactor the dynamic report screen from its current implicit-membership model (sort codes as parent
hints, entities inferred by membership) to an explicit-node model where every entity appears exactly
once, both the bank and the report are full freeform trees, and templates save the report tree with
explicit entity leaf nodes.

---

## Existing implementation (context)

- **DB table**: `accounter_schema.dynamic_report_templates` — columns: `name`, `owner_id`,
  `template` (JSON text), `created_at`, `updated_at`, `is_locked`
- **Template JSON node shape**: `{ id, parent, text, droppable, data }` where
  `data = { descendantSortCodes, descendantFinancialEntities, mergedSortCodes, isOpen, hebrewText }`
- `descendantSortCodes` / `descendantFinancialEntities` are "hint" arrays on branch nodes — entities
  are **not** stored as explicit leaf nodes in the current format
- **GraphQL mutations**: `updateDynamicReportTemplate`, `updateDynamicReportTemplateName`,
  `insertDynamicReportTemplate`, `deleteDynamicReportTemplate`, `lockDynamicReportTemplate`,
  `unlockDynamicReportTemplate`
- **Lock**: DB boolean `is_locked`; lock/unlock mutations exist but are not exposed from the dynamic
  report screen (locked by external flows, e.g. annual audit)
- **Provider**: `DynamicReportProvider` —
  `packages/server/src/modules/reports/providers/dynamic-report.provider.ts`
- **Zod validation**: `dynamicReportTemplate` —
  `packages/server/src/modules/reports/helpers/dynamic-report.helper.ts`
- **Leaf expanded view** currently reuses `BusinessExtendedInfo`, which calls
  `businessTransactionsFromLedgerRecords(businessIDs: [id])`

---

## Required backend changes

### New template node format

| Field                              | Old        | New                                                              |
| ---------------------------------- | ---------- | ---------------------------------------------------------------- |
| `data.nodeType`                    | _(absent)_ | `"synthetic-branch" \| "sort-code-branch" \| "financial-entity"` |
| `data.descendantSortCodes`         | present    | **removed**                                                      |
| `data.mergedSortCodes`             | present    | **removed**                                                      |
| `data.descendantFinancialEntities` | present    | **removed**                                                      |
| `data.isOpen`                      | present    | kept                                                             |
| `data.hebrewText`                  | present    | kept                                                             |

Financial entities are stored as **explicit leaf nodes** in the template JSON array (not inferred
from sort code membership). A financial entity leaf has `droppable: false` and
`data.nodeType: "financial-entity"`.

**Node IDs**:

- Financial entity leaf: entity UUID
- Sort-code branch: sort code DB id
- Synthetic branch: generated string id (e.g. `synthetic-<random>`)

**Files to change**:

- `packages/server/src/modules/reports/typeDefs/dynamic-report.graphql.ts` — `DynamicReportNodeData`
  type: remove `descendantSortCodes`, `mergedSortCodes`, `descendantFinancialEntities`; add
  `nodeType: String!`
- `packages/server/src/modules/reports/helpers/dynamic-report.helper.ts` — Update Zod schema to
  match new shape
- No DB column changes needed (template is stored as an opaque JSON text column)

### Backward compatibility

On template load, detect old format by checking for presence of `descendantSortCodes` on any node.
If detected:

1. Migrate the template in-memory to the new explicit-leaf format using the live entity data
2. Display a prompt informing the user the template is in a legacy format and asking them to resave

---

## Functional specification

### Core data

- Data source: ledger records
- Each side of a ledger record is a **financial entity** (business or tax category)
- The server computes the total local-currency amount per entity for a given date range (existing
  `businessTransactionsSumFromLedgerRecords` query)
- The report displays all entities with their local currency sum

---

### Layout

Two-panel side-by-side layout:

- **Left panel** — Bank
- **Right panel** — Report tree

---

### Bank (left panel)

**Initial / default state** (applied on page load and on template load):

- Entities grouped by sort-code folders
- Sort-code folders ordered ascending by sort code number
- Each sort-code folder label: `<number> — <name>`
- Independent entities (no sort code) listed alphabetically **after** all sort-code folders

**User-controlled state**:

- User can reorder branches and leaves freely (drag handles or drag-and-drop)
- User can create custom synthetic branches in the bank
- Exact user-controlled order is preserved in the session

**Bank state is never saved** to a template. Loading a template always resets the bank to its
initial state.

---

### Report tree (right panel)

- Fully user-structured tree of **branches** (synthetic or sort-code) and **leaves** (financial
  entities)
- Branches show: name, total sum of all descendant leaves (local currency), leaf count
- Branches can contain sub-branches, leaves, or both
- Branches are collapsible/expandable
- Leaves are expandable (shows the ledger records table — see
  [Leaf expanded view](#leaf-expanded-view))

---

### Entity placement — single-presence rule

Every entity exists in **exactly one** location at all times: the bank OR the report tree (never
both).

| Action                                             | Result                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Drag sort-code folder or branch from bank → report | Entire unit (all descendants) moves to report; removed from bank                        |
| Drag single entity from bank → report              | Entity moves to drop position in report                                                 |
| Drag single entity from report → bank              | Entity moves to exact drop position in bank                                             |
| Drag branch from report → bank                     | Branch structure preserved; lands at drop position in bank                              |
| Delete branch (via delete button)                  | Confirmation dialog → if confirmed, entire branch (structure intact) moves to bank root |
| Drag branch within report                          | Entire branch + all descendants move as a unit                                          |

---

### Edit mode

- An explicit **"Edit mode" toggle** is required to enable: drag-and-drop, rename, add branch,
  delete branch
- When a **locked** template is loaded, the edit mode toggle is **disabled or hidden**
- Any structural change (drag, rename, add, delete) marks the session as **dirty**
- Dirty state is visually indicated (e.g. "Unsaved changes" badge in the toolbar)

---

### Templates

**What is saved**: report tree only — branch nodes (synthetic + sort-code), leaf nodes (explicit
entity UUIDs), nesting, order, and `isOpen` state per node.

**What is NOT saved**: bank state.

**On template load**:

1. Entities listed in the template → placed in the report tree as specified
2. All other entities → bank, reset to initial state (sort-code groups, default order)
3. Entities created after the template was saved → always start in the bank

**Dirty-state guard**: if the session has unsaved changes when the user picks a template, show a
confirmation dialog: _"Unsaved changes will be lost. Continue?"_

**Template management** (all from the dynamic report screen):

| Operation | Description                                |
| --------- | ------------------------------------------ |
| Select    | Load a saved template                      |
| Save as   | Save current state as a new named template |
| Resave    | Overwrite the currently loaded template    |
| Rename    | Rename the currently loaded template       |
| Duplicate | Save a copy under a new name               |
| Delete    | Delete a template (with confirmation)      |

**Locked templates**:

- Locked by external flows (e.g. annual audit step) — not from this screen
- When loaded: duplicate only; edit, delete, rename disabled; edit mode toggle hidden
- The `is_locked` flag is a DB boolean; `lockDynamicReportTemplate` / `unlockDynamicReportTemplate`
  mutations exist but are not surfaced here

**Sharing**: templates are shared across all users of the same business owner.

---

### Filters

Same as current implementation:

- Date range (from + to)
- Owner filter
- "Show zeroed accounts" toggle
- All filters persisted in URL query params

---

### Leaf expanded view

**Current implementation** (to reuse for now): `BusinessExtendedInfo` component
(`packages/client/src/components/business-ledger/business-extended-info.tsx`), which calls
`businessTransactionsFromLedgerRecords` with `businessIDs: [entityId]`.

**Future step** (separate work item): replace `BusinessExtendedInfo` with a purpose-built component
for this screen:

- Fixed columns: Business, Date, Local Amount, Local Amount Balance, Reference, Details, Counter
  Account
- Optional foreign currency column pairs (Amount + Balance) — only currencies actually present in
  that entity's ledger records are offered
- Currency toggle state is ephemeral (not saved), defaults to local currency only
- Each entity independently manages its shown foreign currencies

---

### Export

CSV export button — exports the **report tree only** (same as current behavior).

---

### Drag-and-drop library

The refactored component uses **Pragmatic drag and drop** (`@atlaskit/pragmatic-drag-and-drop`) as
the DnD engine, replacing the existing `@minoru/react-dnd-treeview` / `react-dnd` stack.

**Rationale**:

- `react-dnd` (used internally by `@minoru/react-dnd-treeview`) is abandoned and has known React 19
  incompatibilities. The project is on React 19.
- Pragmatic DnD is actively maintained by Atlassian, powers Trello/Jira/Confluence, is
  framework-agnostic (no peer dependency on React internals), and ships a dedicated tree-item hitbox
  package that directly solves the positional drop requirement.

**Packages used**:

| Package                                                           | Purpose                                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `@atlaskit/pragmatic-drag-and-drop`                               | Core draggable / drop-target primitives                                                              |
| `@atlaskit/pragmatic-drag-and-drop-hitbox`                        | Tree-item hitbox: `instruction` objects (`reorder-above`, `reorder-below`, `make-child`, `reparent`) |
| `@atlaskit/pragmatic-drag-and-drop-react-beautiful-dnd-migration` | _(not used)_                                                                                         |

**Data model**: the flat `{ id, parent, droppable, text, data }` node shape (previously from
`NodeModel<CustomData>`) is retained as an internal type (`FlatNode<CustomData>`) so the DB
serialisation format is unchanged. The tree UI builds a nested view from this flat array for
rendering; mutations update the flat array.

**Drop position**: the `@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item` `Instruction` type
encodes where a node should land (`reorder-above`, `reorder-below`, `make-child`, `reparent` with
`desiredLevel`). A shared `applyInstruction` utility translates an `Instruction` into flat-array
mutations.

**`canDrop` equivalent**: the `canDrop` prop is replaced by a guard inside the `onDrop` callback.
The same rules apply — no dropping a branch into a financial-entity leaf; single-presence enforced.

---

## Files affected

| File                                                                                        | Change                                                             |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/server/src/modules/reports/typeDefs/dynamic-report.graphql.ts`                    | Update `DynamicReportNodeData` GraphQL type                        |
| `packages/server/src/modules/reports/helpers/dynamic-report.helper.ts`                      | Update Zod schema + add backward-compat migration helper           |
| `packages/client/src/components/reports/dynamic-report/index.tsx`                           | Main component rewrite                                             |
| `packages/client/src/components/reports/dynamic-report/custom-node.tsx`                     | Node rendering — `nodeType`-aware, edit mode prop                  |
| `packages/client/src/components/reports/dynamic-report/tree-view.tsx`                       | Drag rules — cross-tree, single-presence enforcement               |
| `packages/client/src/components/reports/dynamic-report/types.ts`                            | `CustomData` type — add `nodeType`, remove hint arrays             |
| `packages/client/src/components/reports/dynamic-report/dynamic-report-manage-templates.tsx` | Template management UI (select, resave, rename, duplicate, delete) |
| `packages/client/src/components/reports/dynamic-report/dynamic-report-save-template.tsx`    | Save-as flow                                                       |
| `packages/client/src/components/reports/dynamic-report-2/index.tsx`                         | Prototype main component — Pragmatic DnD wiring                    |
| `packages/client/src/components/reports/dynamic-report-2/tree-panel.tsx`                    | Prototype panel — Pragmatic DnD drop target                        |
| `packages/client/src/components/reports/dynamic-report-2/tree-node.tsx`                     | Prototype node row — Pragmatic DnD draggable + tree-item hitbox    |
