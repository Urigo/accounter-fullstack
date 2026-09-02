# Dynamic report — change tracking against a saved draft

## Context

The dynamic report (`packages/client/src/components/reports/dynamic-report/`) renders two panels: a
**Bank** of unplaced financial entities, and a **Report** tree the user composes by dragging
entities into branches. Each leaf is a financial entity valued at its ledger-record sum for the
selected period; each branch shows the rolled-up sum of its subtree.

A saved layout is a **template** row in `accounter_schema.dynamic_report_templates` (PK
`(owner_id, name)`) holding the report subtree as a JSON string. Saving overwrites in place — there
is no history — and `serializeReportTree` deliberately strips computed values, so no numbers are
ever persisted.

So a user returning to a saved report days later has no way to tell what moved. Ledger records have
been added, edited and reclassified in the meantime; the report simply renders new figures with
nothing indicating which ones changed, by how much, or whether the tree is still the one they built.

This adds a **save-time snapshot** and an **always-on inline diff**, so a revisit immediately shows
the drift.

## Decisions

Settled during spec review. Where a decision closed off an alternative, the reason is given.

| Aspect           | Decision                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tracked changes  | Numbers, structure, and newly-appearing entities.                                                                                                                                                                                           |
| Baseline         | **Frozen snapshot captured at save time** — not an "as of timestamp" recomputation, which cannot see deletions or in-place edits.                                                                                                           |
| Snapshot trigger | **Every save of the template** — Resave, Save-as-new, Duplicate. Nothing else: no explicit checkpoint button, no auto-backfill on first open, no hook on the annual-audit lock. Snapshot ≡ save, so "since I last saved" is literally true. |
| History          | **Full.** One row per save, never pruned. Diff defaults to the latest; older ones are selectable.                                                                                                                                           |
| Snapshot values  | **Client sends what it rendered**, alongside the template. The snapshot is literally the figures on screen at save time.                                                                                                                    |
| Period           | **The draft owns its period.** Date pickers are read-only while a draft is loaded; changing it is an explicit action. Explicit `?from=`/`?to=` in the URL override the draft's period and **suspend** the diff.                             |
| Diff UI          | Delta badge beside the existing value badge, plus a subtle row highlight with a `was → now` tooltip. **Always on** — no compare mode, no summary panel.                                                                                     |
| Structural diff  | Entity entered/left the report; entity moved between branches; branch added, removed or renamed. Sibling reordering is **not** tracked — order is implicit array position with no persisted order field.                                    |
| New entities     | No dedicated detection — the Bank panel already lists every entity with activity that isn't placed. Just a "new since last save" marker on Bank rows whose entity id is absent from the baseline.                                           |

## Step 0 — stop losing dropped leaves

> **Latent data loss — fix this first.** `buildReportTree` (`utils/report-tree.ts:65-66`) discards a
> template leaf whose entity has no sum in the period, and `serializeReportTree` walks the
> **in-memory** tree. So opening a template over a period where an entity had no activity and then
> hitting Resave **permanently deletes that entity from the template**.

Left alone, snapshots would faithfully record the loss and the structural diff would report it as a
deliberate removal. Ship this as its own commit ahead of the feature — it is independently correct
and keeps the snapshot work honest.

Preserve these leaves invisibly: rendering stays exactly as it is today, but a save can no longer
lose them.

- Add `isHidden?: boolean` to `CustomData` in `utils/types.ts`. Runtime-only — **not** serialized,
  so the server's `.strict()` zod schema is untouched.
- `buildReportTree`: instead of `continue`, push the leaf with `value: 0`, `isHidden: true`, and
  `text` from the template node — there is no `bizSum` to read a name from. Do **not** add it to
  `placedEntityIds`.
- Skip hidden nodes in `tree-panel.tsx` `renderSubtree` and in `handleDownloadCSV`
  (`index.tsx:579-591`). `buildNodeStats` already contributes `value ?? 0`, so totals are
  unaffected.
- `serializeReportTree` needs no change — hidden leaves are in the tree, so they survive.

## Step 1 — data model

New migration in `packages/migrations/src/actions/`, following
`2025-02-12T11-50-44.dynamic-report-templates-table.ts` for style.

```sql
ALTER TABLE accounter_schema.dynamic_report_templates
  ADD COLUMN IF NOT EXISTS from_date date,
  ADD COLUMN IF NOT EXISTS to_date   date;

CREATE TABLE accounter_schema.dynamic_report_template_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid        NOT NULL,
  template_name  text        NOT NULL,
  from_date      date        NOT NULL,
  to_date        date        NOT NULL,
  scope_owner_id uuid        NOT NULL,   -- owner the sums were queried for
  tree           jsonb       NOT NULL,   -- same shape as templates.template
  leaf_values    jsonb       NOT NULL,   -- { "<businessId>": number } — leaves only
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dynamic_report_template_snapshots_template_fk
    FOREIGN KEY (owner_id, template_name)
    REFERENCES accounter_schema.dynamic_report_templates (owner_id, name)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX dynamic_report_template_snapshots_lookup_index
  ON accounter_schema.dynamic_report_template_snapshots
     (owner_id, template_name, created_at DESC);
```

`ON UPDATE CASCADE` is what makes rename safe — template identity is `(owner_id, name)` and
`updateTemplateName` rewrites it. Only **leaf** values are stored; branch sums are recomputed with
the existing `buildNodeStats`. The column is `leaf_values` rather than `values`, which is a reserved
word and would need quoting at every use site.

> **Don't skip this half.** A second migration must apply the RLS policy set to the new table,
> copying `2026-08-23T10-00-00.rls-scope-securities-tables.ts` verbatim: the permissive
> `tenant_isolation` policy with
> `USING (owner_id = ANY (accounter_schema.get_current_business_scope()))` and
> `WITH CHECK (owner_id = accounter_schema.get_current_business_id())`, plus the two RESTRICTIVE
> `tenant_isolation_delete` / `tenant_isolation_update` policies. Every other table in this schema
> has them; a new one without them is a tenant-isolation hole.

## Step 2 — GraphQL surface

In `packages/server/src/modules/reports/typeDefs/dynamic-report.graphql.ts`. The `snapshot` argument
is optional so existing callers keep compiling; when present, the resolver writes both the template
row and a snapshot row.

```graphql
type DynamicReportInfo {
  # ...existing fields
  fromDate: TimelessDate
  toDate: TimelessDate
  snapshots: [DynamicReportSnapshotMeta!]! # newest first, for the picker
}

" lightweight snapshot listing, no payload "
type DynamicReportSnapshotMeta {
  id: UUID!
  createdAt: DateTime!
  createdBy: String
  fromDate: TimelessDate!
  toDate: TimelessDate!
}

" a saved baseline: the tree and the figures as they stood at that save "
type DynamicReportSnapshot {
  id: UUID!
  createdAt: DateTime!
  createdBy: String
  fromDate: TimelessDate!
  toDate: TimelessDate!
  scopeOwnerId: UUID!
  tree: [DynamicReportNode!]!
  values: [DynamicReportSnapshotValue!]!
}

type DynamicReportSnapshotValue {
  entityId: UUID!
  value: Float!
}

input DynamicReportSnapshotInput {
  fromDate: TimelessDate!
  toDate: TimelessDate!
  scopeOwnerId: UUID!
  values: [DynamicReportSnapshotValueInput!]!
}

input DynamicReportSnapshotValueInput {
  entityId: UUID!
  value: Float!
}

extend type Query {
  dynamicReportSnapshot(id: UUID!): DynamicReportSnapshot
    @requiresAuth
    @requiresAnyRole(roles: ["business_owner", "accountant"])
}

extend type Mutation {
  updateDynamicReportTemplate(
    name: String!
    template: String!
    snapshot: DynamicReportSnapshotInput
  ): DynamicReportInfo!
  insertDynamicReportTemplate(
    name: String!
    template: String!
    snapshot: DynamicReportSnapshotInput
  ): DynamicReportInfo!
}
```

Run `yarn generate` after editing typeDefs — never hand-write the generated types.

## Step 3 — server

- **`providers/dynamic-report.provider.ts`** — add pgtyped queries `insertSnapshot`,
  `getSnapshotsByTemplate` (DataLoader-batched by `(owner_id, template_name)`) and
  `getSnapshotById`; extend `updateTemplate` / `insertTemplate` to set `from_date` and `to_date`.
  Keep the existing `assertNotLocked` and `invalidateByOwnerId` guards on every write.
- **`helpers/dynamic-report.helper.ts`** — a `validateSnapshotInput` zod schema alongside the
  existing `dynamicReportTemplate` schema: UUID keys, finite numbers, `fromDate <= toDate`, and a
  defensive cap on the values array length.
- **`resolvers/dynamic-report.resolver.ts`** — write the snapshot in the same request as the
  template update/insert, after `validateTemplate`; resolve the new `DynamicReportInfo` fields; add
  the `dynamicReportSnapshot` query. `ownerId` continues to come only from
  `AdminContextProvider.getVerifiedAdminContext()`, never from the client.

## Step 4 — client

All under `packages/client/src/components/reports/dynamic-report/`.

### New pure util — `utils/diff.ts`

The bulk of the logic, and fully testable in isolation.

```ts
export type NodeChange =
  | { kind: 'value'; previous: number; delta: number }
  | { kind: 'added' }
  | { kind: 'removed'; previousValue: number }
  | { kind: 'moved'; previousParentText: string }
  | { kind: 'renamed'; previousText: string }

export type ReportDiff = {
  byNodeId: Map<string, NodeChange[]>
  subtreeDelta: Map<string, number> // rolled-up value delta, per branch
  ghosts: FlatNode<CustomData>[] // removed entities, rendered in place
}

export function buildReportDiff(
  current: FlatNode<CustomData>[],
  baseline: { tree: SerializedNode[]; values: Map<string, number> }
): ReportDiff
```

- Rehydrate the baseline tree from `baseline.tree` + `baseline.values` and run the existing
  `buildNodeStats` over **both** trees; `subtreeDelta` is a per-id subtraction of the two
  `NodeStats` maps. Reuse the tested code rather than writing a second summing pass.
- Leaves join on `FlatNode.id` (the business UUID) and branches on their node id — both stable.
- `moved` = same id, different `parent`. `renamed` = same id, different `text` on a branch.
- **Threshold:** emit a `value` change only when `Math.abs(delta) >= 0.5`. `formatCurrency` uses
  `maximumFractionDigits: 0`, so anything smaller renders as ₪0 and is float noise.

### Rendering

- `tree-node.tsx` — accept an optional `change?: NodeChange[]` prop. Render the delta badge next to
  the existing value badge, reusing the green/red convention already at `tree-node.tsx:195-211`;
  apply the row accent; put `was X → now Y` (and `moved from …` / `was named …`) in the tooltip.
  Ghost rows render muted with the previous value struck through.
- `tree-panel.tsx` — thread `diff` through `renderSubtree`; splice ghost nodes in at their old
  parent; skip `isHidden` nodes.

### Toolbar

- A **"Compare to"** dropdown listing snapshots (`Last save · 12 Aug 2026`, …), defaulting to the
  latest.
- Date pickers `disabled` whenever a template is loaded.
- A **"Change period"** item in the template dropdown, opening a small dialog with two
  `DatePickerInput`s that sets a pending period and marks the draft dirty.
- A notice replacing the badges while the diff is suspended, with a **"back to draft period"**
  button.

### Container — `index.tsx`

- New URL param `baseline` (snapshot id) alongside the existing `from/to/owner/zeroed/template`, set
  with the same `setSearchParams(..., { replace: true })` pattern.
- **Effective period precedence:** explicit URL `from`/`to` → the template's saved period → today's
  `DEFAULT_FROM`/`DEFAULT_TO`. `applyTemplate` must **clear** `from`/`to` when switching templates,
  so a stale override can't leak across drafts.
- Query the chosen snapshot (paused until a template and a snapshot exist); memoize
  `buildReportDiff(reportTree, baseline)`.
- **Suspend the diff** — render the notice, no badges — when there is no snapshot, or when the
  effective period or scope owner differs from the snapshot's.
- `handleResave` (`index.tsx:532-543`) and the save-as-new / duplicate paths pass a `snapshot` built
  from `businessSums` (`entityId → total.raw * -1`, matching what the leaves render) plus the
  effective period and scope owner.

### Hooks

Extend `use-update-dynamic-report-template.ts` and `use-insert-dynamic-report-template.ts` with the
optional `snapshot` argument, keeping the existing `handleCommonErrors` + toast pattern. Components
never call `useMutation` directly.

## Edge cases

- **Annual-audit deep links.** Step 05 (`step-05-main-process/index.tsx:82-101`) builds two links to
  the _same_ locked template with different ranges — Balance Sheet `1900-01-01 → {year}-12-31` and
  P&L `{year}-01-01 → {year}-12-31`. These are exactly the URL override case: both keep working, and
  both render with the diff suspended.
- **Locked templates** can't be updated, so they accrue no new snapshots. The last snapshot before
  the annual-audit lock is the frozen year-end artifact by construction — no extra work.
- **The baseline is per-template, not per-user.** The row is shared across everyone on that
  `owner_id`, which matches "since the draft was last saved". `created_by` is recorded for display
  only.
- **Legacy templates** migrate on read and have no snapshot until their first save; they simply show
  the "no baseline yet" notice.
- **Retention.** Every save writes a row; payloads are a few KB. Keep them all for now and revisit
  pruning if volume becomes real.

## Verification

1. `yarn generate` (the schema changed), then `yarn lint` and `yarn prettier:check`.
2. `yarn test` — new unit tests for `utils/diff.ts` in the existing `dynamic-report/__tests__/`
   directory, which already covers the other six pure utils: value deltas, sub-threshold noise, add
   / remove / move / rename, ghost placement, subtree rollup, and an empty-baseline case.
3. Migration: `docker compose -f docker/docker-compose.dev.yml up -d db`, then
   `yarn workspace @accounter-helper/migrations migration:run`. Verify the cascades — rename a
   template and confirm its snapshots follow; delete one and confirm they go.
4. Manual end-to-end (`yarn server:dev` + `yarn client:dev`):
   - Load a template, Resave, confirm a snapshot row appears and no badges show (zero diff).
   - Mutate a ledger record in range, reload, confirm the leaf shows the right delta and its
     ancestors show the rolled-up delta.
   - Drag an entity between branches and out to the Bank; confirm `moved` and ghost rendering.
   - Open an annual-audit step-05 Balance Sheet link; confirm the report renders at the URL's range,
     the diff is suspended with the notice, and "back to draft period" restores it.
   - Save a template over a period where some entity has no activity, reload over a wider period,
     and confirm the entity is still in the tree — the Step 0 fix.
5. `yarn test:integration` for the server module.

## Out of scope

Deliberately excluded, each considered and set aside during spec review: ledger-record-level
drill-down into what caused a delta; a changes summary panel; a compare-mode toggle; restoring an
old snapshot as the live layout; snapshot pruning.
