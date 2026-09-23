# Dynamic report: accountant approval layer

## Context

#4362 added change tracking to the dynamic report
(`packages/client/src/components/reports/dynamic-report/`). Every save writes a row to
`accounter_schema.dynamic_report_template_snapshots` with the tree and the value of every entity
that had activity. The client then diffs the live tree against a chosen snapshot (`utils/diff.ts` →
`ReportDiff`) and shows the result through `diff-markers.tsx` and `tree-node.tsx`. See
[`docs/dynamic-report-change-tracking/plan.md`](../dynamic-report-change-tracking/plan.md).

This spec adds accountant approval on top of that:

- Every report **leaf** (a financial entity) carries an `AccountantStatus`: `UNAPPROVED`, `PENDING`
  or `APPROVED`. The enum is defined in
  `packages/server/src/modules/accountant-approval/typeDefs/accountant-approval.graphql.ts`.
- The user can toggle a leaf's status.
- Every **branch** shows a status derived from its leaves.
- An approval **regresses** when the entity's ledger changes after sign-off.

Two principles shape everything below:

1. **Approval is a report-level sign-off.** It never reads or writes `charges.accountant_status`.
   One charge usually feeds several entities, for example an expense and a bank account. Tying the
   two together would let approving one leaf silently flip others.
2. **Approval lives inside snapshots.** A snapshot is already keyed the way an approval must be
   (template, period, scope owner). Diffing against the snapshot that holds the approval is what
   explains a regression, so there is no separate "ledger changed" flag.

## Decisions

These were settled during spec review.

| Aspect               | Decision                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What a status means  | A sign-off on this report line, independent of charge approvals.                                                                                                                                              |
| Key                  | (template, entity, `from_date`, `to_date`, `scope_owner_id`). The Balance Sheet and P&L views of one template are approved separately. Moving a leaf between branches keeps its status.                        |
| States               | Mirrors charges: all three are user-selectable. A leaf with no stored status is `UNAPPROVED`.                                                                                                                 |
| Regression trigger   | The entity's **ledger fingerprint** for the period changed. This catches edits that net to ₪0, not only value drift.                                                                                          |
| Regression target    | `APPROVED` → `PENDING`. `UNAPPROVED` and `PENDING` are unaffected.                                                                                                                                            |
| Regression timing    | **Derived on read**, never written by a read. A save records each leaf's effective status, so a regression becomes stored at the next save and saving can never re-approve.                                   |
| Storage              | In snapshot rows: new `leaf_fingerprints` and `leaf_approvals` jsonb columns.                                                                                                                                 |
| Persisting a toggle  | Held as an unsaved edit until **Resave** or **Save review**. One review session produces one snapshot.                                                                                                        |
| Baseline picker      | Statuses follow the snapshot the diff uses. The default baseline becomes the newest snapshot **for the current period and owner**. An older pinned baseline shows its statuses read-only, as history.          |
| Branch status        | Worst wins, red first: `UNAPPROVED` > `PENDING` > `APPROVED`. The tooltip shows counts.                                                                                                                       |
| Bulk                 | A branch's status dropdown writes the chosen status to every counted leaf in its subtree.                                                                                                                     |
| Availability         | Not gated by the Edit switch. Works on locked templates. Disabled when no saved template is loaded, or while an older baseline is pinned.                                                                     |
| Roles & audit        | Both `business_owner` and `accountant` may set any status. Each leaf records who set it and when. A save-time regression is stamped as **system**.                                                            |
| Fingerprint content  | Money, dates and counterparty. Description and reference are excluded.                                                                                                                                        |
| Report-level UI      | A progress line and a **Needs review** filter in the toolbar.                                                                                                                                                 |
| Save as new / Dup.   | Start clean: the new template's first snapshot carries no statuses.                                                                                                                                           |
| Annual audit         | Out of scope. A follow-up issue will be opened (see [Rollout](#rollout)).                                                                                                                                      |

## Functional requirements

### Leaf status

- **R1.** Every counted leaf in the **report** tree shows a status icon, using
  `accountantApprovalOptions` from `components/common/inputs/update-accountant-status.tsx`: green
  check, yellow clock, red X.
  - A counted leaf is a visible financial-entity leaf. Leaves with `isHidden` and ghost rows are not
    counted.
  - A leaf whose activity nets to ₪0 is still counted.
  - The bank tree shows no statuses.
- **R2.** Clicking the icon opens a dropdown with all three states. Choosing one stages the change
  and marks the report dirty. Nothing is sent to the server until the user saves.
- **R3.** A leaf's effective status is resolved in this order:
  1. The staged override, if the user made one.
  2. Otherwise the status stored in the active baseline snapshot, with one exception: a stored
     `APPROVED` whose baseline fingerprint differs from the current fingerprint resolves to
     `PENDING`.
  3. Otherwise `UNAPPROVED`. This covers leaves with no stored status, leaves added since the
     baseline, and legacy snapshots that have no fingerprints or statuses.
- **R4.** The tooltip shows who last set the status and when, taken from the snapshot:
  - `Approved by <name> · <date>` for a user stamp.
  - `Returned to pending · ledger changed after approval · <date>` for a system stamp.
  - A staged change reads `Unsaved change`.

### Branch status

- **R5.** A branch's status comes from its counted descendants. It is `UNAPPROVED` if any is
  `UNAPPROVED`, otherwise `PENDING` if any is `PENDING`, otherwise `APPROVED`. A branch with no
  counted descendants shows no icon.
- **R6.** The branch tooltip shows counts, for example `7 approved · 2 pending · 1 unapproved`.
- **R7.** The branch icon is also a dropdown. Choosing a status stages that status for every counted
  leaf in the subtree.

### Regression

- **R8.** Nothing is written when the report loads. A regression is visible only through R3.
- **R9.** A save sends the **effective** status of every counted leaf. The server stamps a leaf as
  **system** when all three of these hold:
  - its previous stored status was `APPROVED`,
  - it arrives as `PENDING`,
  - its fingerprint changed.
- **R10.** If the ledger goes back to exactly the approved content before a save, the leaf reads
  `APPROVED` again.

### Persistence and availability

- **R11.** There are two ways to persist:
  - **Resave** (unlocked templates) persists structure and statuses together through
    `updateDynamicReportTemplate`.
  - **Save review** writes a snapshot only, through `captureDynamicReportBaseline`. It is
    available when status changes are the only unsaved change, on locked **and** unlocked
    templates. It replaces the locked-only "Capture baseline" menu item.

  Save review never touches the template row. That means a locked template stays locked, and an
  unlocked draft's own period doesn't move when someone reviews a deep-linked period.
- **R12.** Toggles are disabled, with an explanatory tooltip, in three cases:
  - no saved template is loaded;
  - an older baseline is pinned, because that is a read-only history view;
  - the data is still loading.
- **R13.** Changing the period, owner or pinned baseline while status changes are staged asks the
  user to confirm discarding them, because they belong to the old scope. Staged structural edits
  are kept. Switching template goes through the existing `DirtyTemplateSwitchConfirmation`.
- **R14.** Save as new and Duplicate create a template whose first snapshot has no statuses.
- **R15.** A leaf removed from the report loses its status at the next save. If it is re-added
  later it starts `UNAPPROVED`.

### Baseline selection

- **R16.** The default baseline is the newest snapshot whose `fromDate`, `toDate` and
  `scopeOwnerId` match the view.
  - If none matches, fall back to `snapshots[0]`. The diff is then suspended exactly as it is
    today, all leaves read `UNAPPROVED`, and toggles are enabled. The save creates this period's
    first snapshot.
  - Choosing that default in the picker clears `?baseline=`, as today.
- **R17.** The picker's "Last save" label marks the snapshot chosen by R16, not index 0.

### Diff addition

- **R18.** Add a new change kind, `records`. It is emitted when a leaf exists in both trees, its
  value delta is below `DELTA_THRESHOLD`, and the baseline fingerprint exists and differs from the
  current one.
  - Label: `edited`.
  - Tooltip: `Ledger records changed — total unchanged`.
  - This guarantees that every derived `PENDING` has a visible marker explaining it.

### Report-level UI

- **R19.** The toolbar shows progress over counted leaves, for example
  `124 / 150 approved · 6 pending`.
- **R20.** A **Needs review** switch, persisted as `?review=1`, filters the report tree to
  non-approved counted leaves and their ancestors. Those ancestors are force-expanded.
  - Branch sums stay unfiltered.
  - The force-expansion is a render-time overlay and never writes `node.data.isOpen`, which is
    serialized into the template.
- **R21.** The CSV export gains a `Status` column holding each leaf's effective status and each
  branch's derived status.
- **R22.** The status icon sits in a fixed-width slot at the far right of each report row, so the
  icons line up as a column. Ghost rows have no icon.

## Architecture

```
            ┌────────────── read ──────────────┐
 ledger ──► businessTransactionsSumFromLedgerRecords ──► value + ledgerFingerprint per entity
                                                  │
 snapshot (newest comparable) ──► values, fingerprints, approvals
                                                  │
 client: deriveLeafStatuses(stored, baselineFp, currentFp) ⊕ staged overrides ──► effective
                                                  │
            ┌────────────── write (Resave / Save review) ──────────────┐
 client sends values + fingerprints + effective statuses
 server: previous comparable snapshot ──► stampApprovals ──► insert snapshot row
```

### Ledger fingerprint

- Computed in the same pass, and from the same records, as the values, in
  `financial-entities/resolvers/business-transactions-sum-from-ledger-records.resolver.ts`.
  - A record qualifies when its `invoice_date` is in [from, to], after the existing revaluation
    filter.
  - Every entity slot a record touches contributes one tuple to that entity.
- Tuple fields:
  - `charge_id`;
  - the side (`credit` | `debit`) and slot (`1` | `2`) this entity occupies;
  - the local and foreign amounts for that slot, normalised to 2 decimals;
  - `currency`;
  - `invoice_date` and `value_date` as `YYYY-MM-DD`;
  - the sorted, de-duplicated entity ids on the **other** side.
- Excluded: ledger-record ids, `description` and `reference1`. Leaving out record ids means a
  regeneration that deletes and re-inserts identical content doesn't regress an approval.
- Hash: join each tuple's fields with `|`, sort the tuples, join them with `\n`, then sha256 as hex
  using `node:crypto`. An entity with no records has no fingerprint, because it has no sum either.
- Exposed as `ledgerFingerprint: String!` on `BusinessTransactionSum`.
  `RawBusinessTransactionsSum` (`shared/types/index.ts`) carries the collected tuples, and this
  resolver is its only producer.
- Known effect: while `toDate` is today or later, revaluation records dated `toDate` move with
  exchange rates. Foreign-currency leaves in an open period will therefore keep regressing. Closed
  periods are stable.

### Why statuses are stored in snapshots

- Snapshots are append-only records of a moment. A toggle can't mutate one, and writing a snapshot
  per click would rebase the diff for every other leaf and hide changes nobody reviewed. That is
  why toggles are staged and persisted with a save (R2, R11).
- Because a save persists effective statuses (R9), the stored status of an `APPROVED` leaf always
  refers to the fingerprint stored in the same row. So a single `leaf_fingerprints` map serves both
  the diff (R18) and the regression check (R3).

## Data model

### Migration

Create `packages/migrations/src/actions/2026-09-23T10-00-00.dynamic-report-snapshot-approvals.ts`
and register it in `run-pg-migrations.ts` after
`migration_2026_09_09T10_00_00_uuidv7_id_defaults`.

```sql
ALTER TABLE accounter_schema.dynamic_report_template_snapshots
  ADD COLUMN IF NOT EXISTS leaf_fingerprints jsonb,
  ADD COLUMN IF NOT EXISTS leaf_approvals    jsonb;

CREATE INDEX IF NOT EXISTS dynamic_report_template_snapshots_comparable_index
  ON accounter_schema.dynamic_report_template_snapshots
     (owner_id, template_name, from_date, to_date, scope_owner_id, created_at DESC);
```

- Both columns are nullable, and legacy rows stay `NULL`: no backfill.
- RLS already covers the table (`2026-09-02T10-30-00`).
- The FK `(owner_id, template_name)` uses `ON UPDATE CASCADE ON DELETE CASCADE`, so renaming a
  template keeps its approvals and deleting it removes them.

### JSON shapes

```ts
// leaf_fingerprints — same coverage as leaf_values: every entity with activity
type LeafFingerprints = Record<EntityId, string>;

// leaf_approvals — counted report leaves only; absent entry = UNAPPROVED, never touched
type LeafApprovals = Record<
  EntityId,
  {
    status: 'APPROVED' | 'PENDING' | 'UNAPPROVED';
    setBy: string | null; // user id; null when system-stamped
    setAt: string; // ISO timestamp, server clock
    system: boolean;
  }
>;
```

`created_by` is currently hard-coded to `null` in `toSnapshotRow`. Fill it from
`AuthContextProvider.getAuthContext()` (`user.userId`).

### GraphQL

In `reports/typeDefs/dynamic-report.graphql.ts`:

```graphql
extend type DynamicReportSnapshotValue { fingerprint: String }          # null on legacy rows
extend input DynamicReportSnapshotValueInput { fingerprint: String! }

type DynamicReportLeafApproval {
  entityId: UUID!
  status: AccountantStatus!
  setAt: DateTime!
  " display name (BusinessUser name ?? email); null when set by the system "
  setBy: String
  isSystem: Boolean!
}
input DynamicReportLeafApprovalInput {
  entityId: UUID!
  status: AccountantStatus!
}

extend type DynamicReportSnapshot { approvals: [DynamicReportLeafApproval!]! }   # [] on legacy
extend input DynamicReportSnapshotInput { approvals: [DynamicReportLeafApprovalInput!] }
extend type DynamicReportSnapshotMeta { scopeOwnerId: UUID! }
```

These additions are written inline in the existing type definitions, not as `extend`. The only
schema-breaking change is that `DynamicReportSnapshotValueInput.fingerprint` is required, and the
only caller is this client, which ships in the same PR.

In `financial-entities/typeDefs/businesses-transactions.graphql.ts`, add
`ledgerFingerprint: String!` to `BusinessTransactionSum`.

## Server implementation

1. **`financial-entities/helpers/ledger-fingerprint.helper.ts`** (pure). Exports
   `ledgerFingerprintTuple(record, entityId, side, slot): string` and
   `hashLedgerFingerprint(tuples: string[]): string`.
2. **Sum resolver.** Push a tuple next to each `handleBusinessLedgerRecord` call, and resolve
   `ledgerFingerprint` by hashing the collected tuples.
3. **`reports/helpers/dynamic-report.helper.ts`.**
   - Extend the zod schema `dynamicReportSnapshotInput` with the per-value `fingerprint`
     (non-empty string) and `approvals` (an array of `{ entityId: uuid, status: enum }`, entity ids
     unique).
   - Add converters in the style of `snapshotValuesToRecord` and `recordToSnapshotValues` for
     fingerprints and approvals.
4. **`reports/helpers/dynamic-report-approvals.helper.ts`** (pure).
   `stampApprovals({ incoming, incomingFingerprints, leafIds, previous, userId, now })` builds a
   `LeafApprovals`:
   - Drop incoming entries whose entity is not a leaf of the submitted tree.
   - For each remaining entry, where `prev = previous?.approvals[entityId]`:
     - `prev?.status === status` → keep `prev` unchanged (carry its stamp forward).
     - `prev?.status === 'APPROVED' && status === 'PENDING' && previous.fingerprints[entityId] !== incomingFingerprints[entityId]`
       → `{ status, setBy: null, setAt: now, system: true }`.
     - `status === 'UNAPPROVED' && !prev` → omit the entry.
     - Anything else → `{ status, setBy: userId, setAt: now, system: false }`.
5. **`reports/providers/dynamic-report.provider.ts`.**
   - Add `getLatestComparableSnapshot({ ownerId, templateName, fromDate, toDate, scopeOwnerId })`,
     a `SELECT … ORDER BY created_at DESC LIMIT 1` query that uses the new index.
   - Extend `insertSnapshot` with `leafFingerprints` and `leafApprovals`.
   - In `updateTemplateWithSnapshot`, and in a new transactional capture method, run the
     previous-snapshot lookup **inside the same transaction** as the insert. The resolver passes a
     stamping callback, so two concurrent saves each stamp against the row they actually follow.
6. **`reports/resolvers/dynamic-report.resolver.ts`.**
   - `toSnapshotRow` takes the fingerprints, the stamped approvals and `createdBy`.
   - `updateDynamicReportTemplate` and `captureDynamicReportBaseline` stamp their approvals.
   - `insertDynamicReportTemplate` ignores `approvals` (R14).
   - Field resolvers: `DynamicReportSnapshot.values[].fingerprint` and `approvals`. `setBy` is
     resolved to a display name through the auth module's business-users provider, batched.
7. Run `yarn generate`.

## Client implementation

1. **Queries** (`dynamic-report/index.tsx`):
   - `DynamicReport` adds `ledgerFingerprint`.
   - `DynamicReportSnapshot` adds `values { fingerprint }` and
     `approvals { entityId status setAt setBy isSystem }`.
   - `DynamicReportTemplate` snapshots add `scopeOwnerId`.
2. **`utils/types.ts`.** Add a runtime-only `fingerprint?: string` to `CustomData`, like `value`.
   `serializeReportTree` must not emit it; assert this in `template-serialization.test.ts`. Set it
   in three places:
   - `buildReportTree` (`utils/report-tree.ts`);
   - `migrateLegacyTemplateNodes`;
   - the Effect 2 value patch in `index.tsx`, including it in the "unchanged" short-circuit.
3. **`utils/diff.ts`.** `Baseline` gains `fingerprints: Map<string, string>`. `rehydrateBaseline`
   carries the fingerprints, and `buildReportDiff` emits `{ kind: 'records' }` per R18.
   `diff-markers.tsx` gets its `explain` text and `marker` label.
4. **`utils/approvals.ts`** (new, pure):
   - `deriveLeafStatuses(tree, approvals, baselineFingerprints) → Map<entityId, EffectiveApproval>`
     implements R3 steps 2–3.
   - `resolveStatus(entityId, derived, overrides)` implements R3 step 1.
   - `buildApprovalStats(nodes, statusOf) → Map<nodeId, { approved, pending, unapproved }>`: one
     post-order pass that mirrors `buildNodeStats` and skips hidden leaves.
   - `branchStatus(counts) → AccountantStatus | null` implements R5.
   - `countedLeafIds(nodes, rootId)` for the bulk set, built on `getDescendantIds`.
   - `buildApprovalsInput(tree, statusOf)` produces the input for every counted leaf.
5. **State** (`index.tsx`):
   - `approvalOverrides: Map<string, AccountantStatus>`. Setting a value equal to the derived
     status deletes the key.
   - `hasStagedApprovals` joins `isDirty` for the dirty indicator and the template-switch
     confirmation. `canSaveReview = hasStagedApprovals && !structuralDirty`.
   - Clear the overrides after a successful Resave, Save review or Save as new, and on template
     switch.
   - Changing the period, owner or baseline prompts per R13, through a new small confirmation
     dialog in `dialogs/`.
   - `latestBaselineId` follows R16. `approvalsReadOnly = !currentTemplate || activeBaselineId !== latestBaselineId`.
6. **`utils/snapshot.ts`.** `buildSnapshotInput` adds `fingerprint` per value (from
   `business.ledgerFingerprint`) and `approvals`. The Save as new path passes none.
7. **Components.**
   - Split `common/inputs/update-accountant-status.tsx` into a presentational
     `AccountantStatusMenu({ value, onChange, disabled, tooltip })` and the existing mutation
     wrapper, which the charges table keeps using unchanged.
   - New `dynamic-report/approval-status.tsx`: a leaf variant (attribution tooltip) and a branch
     variant (counts tooltip, bulk set).
   - `tree-node.tsx` renders it in the fixed right-hand slot (R22), for `treeId === 'report'`
     only. `tree-panel.tsx` plumbs the approval props the same way it plumbs `rowDiff`, and applies
     the Needs review filter through a `forceOpenIds` set checked next to `node.data.isOpen` in
     `renderSubtree`.
   - `toolbar.tsx`: the progress line, the Needs review switch, and Save review, which replaces
     Capture baseline.
8. **`utils/search-params.ts`.** `review` is written with `writeParam`, and `selectTemplateParams`
   keeps it, since it isn't scoped to a draft.
9. **CSV.** Add the `Status` column in `handleDownloadCSV`.

## Error handling

| Situation                                                        | Behaviour                                                                                                                                                                                                                     |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid snapshot input (bad UUID, duplicate entity, empty fingerprint) | zod rejects it inside `validateSnapshotInput`, and the resolver throws a `GraphQLError` with the zod message. Nothing is written: the template and snapshot share one transaction, so a failed save is all-or-nothing.  |
| Approval for an entity that is not a leaf of the submitted tree  | Dropped by `stampApprovals` and logged at `warn`. It is not an error, because it can only come from a stale client.                                                                                                        |
| Previous-snapshot lookup fails                                   | The transaction aborts and the save fails as a whole.                                                                                                                                                                          |
| Resave on a locked template                                      | Unchanged: `assertNotLocked` rejects it. The UI never offers it; Save review is the path.                                                                                                                                      |
| Ledger changes between load and save                             | No rejection. The client sends the fingerprints it displayed, from the same read as the values, and the server stores them. The next load sees them as stale and derives `PENDING`, so nothing unseen can be approved.     |
| Concurrent saves by two reviewers                                | Both snapshots are kept. Each is stamped against the previous comparable row inside its own transaction, and the newest becomes the default baseline.                                                                          |
| Mutation fails on the client                                     | The existing hooks (`useUpdateDynamicReportTemplate`, `useCaptureDynamicReportBaseline`) show an error toast. Staged overrides and the dirty state are **kept**, so the user can retry.                                      |
| `setBy` user no longer resolvable                                | `setBy: null` with `isSystem: false`. The tooltip reads `Approved by a former user · <date>`.                                                                                                                                  |
| Legacy snapshot (null columns)                                   | Fingerprints and approvals resolve to `null` and `[]`. Every leaf is `UNAPPROVED` and no `records` marker appears.                                                                                                            |
| Sums query errors (`CommonError`)                                | As today, `businessSums` is empty. All leaves are hidden and uncounted, and toggles have nothing to act on.                                                                                                                   |

## Testing plan

### Server unit tests (`yarn test`)

- **`ledger-fingerprint.helper.test.ts`:**
  - The result doesn't depend on record order.
  - Changing a record's id with identical content gives the same hash.
  - Changing `description` or `reference1` gives the same hash.
  - Changing an amount, currency, invoice or value date, the counter-entity, the side or the slot
    each gives a different hash.
  - Amounts such as `100` and `100.00` normalise to the same value.
- **`dynamic-report-approvals.helper.test.ts`:**
  - An unchanged status carries its stamp forward.
  - A new status gets a user stamp.
  - `APPROVED`→`PENDING` with a changed fingerprint gets a system stamp.
  - `APPROVED`→`PENDING` with the same fingerprint (a manual change) gets a user stamp.
  - `UNAPPROVED` with no previous entry is omitted.
  - `APPROVED`→`UNAPPROVED` is kept with a stamp.
  - Entries for non-leaf entities are dropped.
  - With `previous = null`, every entry gets a user stamp.
- **`dynamic-report.helper.test.ts`:** the extended zod schema (duplicate entity ids and missing
  fingerprints are rejected) and round-trips through the converters.
- **Sum resolver:** `ledgerFingerprint` is produced per entity and is stable across calls.

### Server integration tests (`yarn test:integration`, DB up and migrated)

Follow `providers/__tests__/dynamic-report-lock.provider.test.ts`:

- `getLatestComparableSnapshot` ignores rows for other periods or owners and returns the newest
  match.
- Resave with approvals, then read back: the snapshot has the fingerprints and approvals with
  stamps, and `created_by` is set.
- Capture baseline on a locked template writes approvals and leaves the template row untouched.
- `insertDynamicReportTemplate` stores no approvals.
- Renaming a template keeps its snapshots' approvals (the FK cascade).
- Legacy row with `NULL` columns: `approvals: []` and `fingerprint: null`.

### Client unit tests (`yarn test:client`, after `yarn generate`)

- **`__tests__/approvals.test.ts`:**
  - Derivation: a stale `APPROVED` becomes `PENDING`, a missing entry is `UNAPPROVED`, legacy data
    gives all `UNAPPROVED`.
  - An override wins, and an override equal to the derived status is dropped.
  - Worst wins, including a branch with no counted leaves (`null`).
  - Hidden leaves are excluded from counts.
  - Bulk set reaches nested leaves and skips hidden ones.
- **`__tests__/diff.test.ts`:** `records` is emitted only for a sub-threshold delta with a changed
  fingerprint, never for legacy baselines, and never alongside `value`.
- **`__tests__/search-params.test.ts`:** `review` is written, cleared, and kept by
  `selectTemplateParams`.
- **`__tests__/template-serialization.test.ts`:** `fingerprint` is never serialized.
- **Snapshot input test:** fingerprints and approvals are included, and the Save as new path
  carries no approvals.
- **Tree sync test (`tree-sync` / Effect 2 logic):** a fingerprint change alone produces a new node
  object.

### Commands before pushing

`yarn generate`, `yarn lint`, `yarn prettier:check`, `yarn test`,
`yarn workspace @accounter/server typecheck`, and client `tsc --noEmit`. A green vitest run doesn't
mean the client builds; see `packages/client/CLAUDE.md`.

### Manual acceptance (`yarn server:dev` + `yarn client:dev`)

1. Load a template, approve three leaves, and bulk-approve one branch. The progress line and branch
   icons update, and "Unsaved changes" shows. Resave, reload, and the statuses persist with an
   `Approved by …` tooltip.
2. Edit an amount in a ledger record behind an approved leaf and reload. The leaf and its ancestors
   read `PENDING`, and the leaf shows a delta badge.
3. Move a record's value date within the period, so the total is unchanged. The leaf reads
   `PENDING` and shows the `edited` marker.
4. Save review. The tooltip reads `Returned to pending · ledger changed after approval`.
5. Pin an older baseline. The statuses show that save's values and the toggles are disabled.
6. Open a locked template through annual-audit step 05 (Balance Sheet, then P&L). Each period
   starts independently, and Save review persists per period without unlocking anything.
7. Needs review hides approved subtrees without changing the saved `isOpen`: toggle it off, Resave,
   and confirm the template's expansion is unchanged.
8. Stage statuses, then change the period. The discard prompt appears.
9. The CSV export has a Status column.

## Rollout

1. Server: migration, fingerprint, schema, stamping. Old clients keep working until `fingerprint`
   becomes required, so ship server and client in one PR.
2. Client: everything above.
3. Open a GitHub issue, **"Dynamic report approvals in the annual audit flow"**, containing:
   - Step 09 (`step-09-save-template`) locks the year's template through
     `AnnualAuditProvider` → `DynamicReportProvider.lockTemplate`.
   - Step 05 (`step-05-main-process`) deep-links the Balance Sheet (1900-01-01 → year-end) and the
     P&L (the calendar year) of that locked template.
   - Approvals live in `leaf_approvals` on the newest snapshot comparable to each period.
   - Candidate directions: show approval progress per period in steps 05/09, or gate step 05 on
     every counted leaf being approved.

## Out of scope

- Any coupling to `charges.accountant_status`.
- Statuses on the bank tree.
- Annual-audit integration (follow-up issue).
- Notifications and approval history beyond what snapshots already keep.
