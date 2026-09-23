# Blueprint: Dynamic report accountant approval

This plan implements [`spec.md`](./spec.md) in small, test-first steps. Each step ends with its code
wired into the running app. No step leaves a helper that nothing calls, and every step leaves the
repo green: `yarn generate`, `yarn lint`, `yarn test`, the server typecheck and the client
`tsc --noEmit` all pass.

## How the plan was sized

**Round 1 — five phases, the natural seams of the feature:**

1. Fingerprints: compute them, store them, and diff on them.
2. Picking the right baseline for the current period and owner.
3. Server-side approvals: the write path, then the read path.
4. Client-side approvals: display, staging, bulk set, saving.
5. Report-level UI: progress, the Needs review filter, CSV, and the rollout.

**Round 2 — chunks.** Round 1 gave 9 chunks. Three were too big to test safely:

- "Fingerprints end-to-end" touched a SQL migration, two GraphQL modules, the client tree, and the
  diff.
- "Client approvals" mixed display, state, persistence and bulk behaviour.
- "Toolbar" mixed four unrelated controls.

**Round 3 — steps.** Each chunk was split at points where the app still works and something new is
testable. That gave 20 steps. They were then reviewed against three rules:

- **No orphans.** A pure helper ships in the same step as its first caller. For example, the
  fingerprint helper ships with the resolver that uses it, and the approval utils ship with the
  read-only display.
- **No schema break mid-plan.** The required `fingerprint` input field and the client that sends it
  land in the same step (step 3). The `approvals` input starts optional, and the client begins
  sending it in step 12.
- **One risk per step.** Migrations, transactional code, and React state changes each get their own
  step, with the test for that risk written first.

Two merges came out of the review:

- Filling `created_by` joined the stamping step, because it needs the same auth lookup.
- The `records` diff kind joined the step that puts fingerprints on nodes. On its own, the
  fingerprint on a node was dead data.

One split came out of it too: Needs review moved into its own step, apart from the progress line,
because it changes how the tree renders.

**Result: 19 steps.**

## Conventions that apply to every step

- Use `yarn` only, never npm, npx or pnpm. Import paths end in `.js`, including imports of `.ts`
  files.
- After any typeDefs or SQL change, run `yarn generate`. Never edit generated files.
- Server: resolvers use `context.injector.get(Provider)`, and only providers touch the DB. Unit
  tests go in `__tests__/*.test.ts` next to the code. DB-backed tests are named
  `*.integration.test.ts`.
- Client: tests go in `packages/client/src/components/reports/dynamic-report/__tests__/`. There is
  no `@testing-library` in this package: render with `createRoot` + `act` when a component test is
  needed. Prefer testing pure utils.
- Commit at the end of every step, with a conventional message, after `yarn lint` and `yarn test`
  pass.

---

## Phase 1 — Fingerprints

### Step 1: Ledger fingerprint on business sums

Context: every approval check in the feature compares ledger fingerprints. They must come from
exactly the records that `businessTransactionsSumFromLedgerRecords` sums, so they are computed in
that same loop.

```text
You are working in the accounter-fullstack monorepo (yarn v4, ESM, TypeScript strict). Read
docs/dynamic-report-accountant-approval/spec.md, section "Ledger fingerprint".

Goal: expose a per-entity ledger fingerprint on BusinessTransactionSum.

1. TDD first. Create
   packages/server/src/modules/financial-entities/helpers/__tests__/ledger-fingerprint.helper.test.ts.
   Test two functions that don't exist yet:
   - ledgerFingerprintTuple(record, entityId, side: 'credit' | 'debit', slot: 1 | 2): string
   - hashLedgerFingerprint(tuples: string[]): string
   Build the records with the IGetLedgerRecordsByChargesIdsResult shape (see
   packages/server/src/modules/ledger/types.js). Cases:
   a. The hash doesn't depend on tuple order.
   b. Two records identical except for `id` give the same hash.
   c. Changing `description` or `reference1` doesn't change the hash.
   d. Each of these changes the hash: the local amount, the foreign amount, the currency,
      invoice_date, value_date, the counter-entity on the other side, the side, the slot.
   e. Amounts '100' and '100.00' give the same tuple.
   f. The tuple lists the other side's entity ids sorted and de-duplicated, and never includes
      the entity itself.
   g. The output is a 64-char lowercase hex string.
2. Implement packages/server/src/modules/financial-entities/helpers/ledger-fingerprint.helper.ts.
   The tuple fields, joined with '|', are: charge_id, side, slot, local amount (toFixed(2)),
   foreign amount (toFixed(2), or '' when null), currency, invoice_date and value_date (as
   YYYY-MM-DD, via dateToTimelessDateString from shared/helpers), and the other-side entity ids
   (sorted, joined with ','). hashLedgerFingerprint sorts the tuples, joins them with '\n', and
   returns sha256 hex from node:crypto.
3. Wire it in:
   - In packages/server/src/shared/types/index.ts, add `fingerprintTuples: string[]` to
     RawBusinessTransactionsSum. Find where handleBusinessLedgerRecord (financial-entities/helpers/
     business-transactions.helper.ts) creates a new entry and initialise it to [] there.
   - In financial-entities/resolvers/business-transactions-sum-from-ledger-records.resolver.ts,
     after each of the four handleBusinessLedgerRecord calls, push
     ledgerFingerprintTuple(ledger, entity, side, slot) onto rawRes[entity].fingerprintTuples.
     The date and revaluation filters above stay as they are.
   - In financial-entities/typeDefs/businesses-transactions.graphql.ts, add
     `ledgerFingerprint: String!` to BusinessTransactionSum. Resolve it in the existing
     BusinessTransactionSum field resolvers (search the module's resolvers for it) with
     hashLedgerFingerprint(parent.fingerprintTuples).
4. Run yarn generate, yarn test, and yarn workspace @accounter/server typecheck. Commit.
```

### Step 2: Migration and provider support for the new snapshot columns

Context: the storage lands first and is exercised by the existing save path, which writes `NULL`
for now. That keeps the migration step isolated from any GraphQL change.

```text
Goal: add leaf_fingerprints and leaf_approvals to dynamic_report_template_snapshots, and let the
provider write them.

1. Create packages/migrations/src/actions/2026-09-23T10-00-00.dynamic-report-snapshot-approvals.ts.
   Copy the structure of 2026-09-02T10-00-00.dynamic-report-template-snapshots.ts and give it a
   doc comment explaining the two columns. The SQL:
     ALTER TABLE accounter_schema.dynamic_report_template_snapshots
       ADD COLUMN IF NOT EXISTS leaf_fingerprints jsonb,
       ADD COLUMN IF NOT EXISTS leaf_approvals jsonb;
     CREATE INDEX IF NOT EXISTS dynamic_report_template_snapshots_comparable_index
       ON accounter_schema.dynamic_report_template_snapshots
       (owner_id, template_name, from_date, to_date, scope_owner_id, created_at DESC);
   Register it in packages/migrations/src/run-pg-migrations.ts, right after
   migration_2026_09_09T10_00_00_uuidv7_id_defaults, following the same import and array pattern.
2. In packages/server/src/modules/reports/providers/dynamic-report.provider.ts, extend the
   insertSnapshot SQL with leaf_fingerprints and leaf_approvals, bound to $leafFingerprints and
   $leafApprovals. Leave getSnapshotsMetaByOwnerIds alone: it stays light.
3. In reports/resolvers/dynamic-report.resolver.ts, make toSnapshotRow pass
   leafFingerprints: null and leafApprovals: null for now.
4. Tests:
   - Update providers/__tests__/dynamic-report-lock.provider.test.ts if its SQL matching or
     expectations need the new params.
   - Add providers/__tests__/dynamic-report-snapshots.integration.test.ts. Follow the style of the
     existing *.integration.test.ts files under packages/server/src/modules (find one with grep
     and copy its DB and bootstrap setup). It inserts a template, then a snapshot with
     leafFingerprints: JSON.stringify({ a: 'x' }), then reads the row back with getSnapshotById and
     asserts leaf_fingerprints round-trips and leaf_approvals is null.
5. Run yarn generate (pgtyped), yarn test, and yarn test:integration if a DB is available (say so
   if not). Commit.
```

### Step 3: Snapshots carry fingerprints end to end

Context: this is the only step with a required input change, so the client that sends the field
ships in the same step.

```text
Goal: every save stores the fingerprints that were on screen, and a snapshot read returns them.

Server:
1. Tests first, in reports/helpers/__tests__/dynamic-report.helper.test.ts:
   - validateSnapshotInput rejects a value with no fingerprint, or with an empty one.
   - A new snapshotFingerprintsToRecord(values) returns { [entityId]: fingerprint }.
   - A new recordToSnapshotFingerprints(raw: unknown) returns a Map. It gives an empty Map for
     null or garbage input (legacy rows).
2. In reports/helpers/dynamic-report.helper.ts, extend the dynamicReportSnapshotInput zod schema
   so each value has `fingerprint: z.string().min(1)`. Implement the two converters.
3. In reports/typeDefs/dynamic-report.graphql.ts:
   - DynamicReportSnapshotValueInput gets `fingerprint: String!`.
   - DynamicReportSnapshotValue gets `fingerprint: String`, described as "null on snapshots saved
     before fingerprints existed".
4. In the resolver, toSnapshotRow writes
   leafFingerprints: JSON.stringify(snapshotFingerprintsToRecord(snapshot.values)).
   DynamicReportSnapshot.values maps each value to its fingerprint from
   recordToSnapshotFingerprints(snapshot.leaf_fingerprints).get(entityId) ?? null.

Client:
5. Tests first, in dynamic-report/__tests__/snapshot.test.ts (create it): buildSnapshotInput
   copies business.ledgerFingerprint into each value's fingerprint.
6. In dynamic-report/index.tsx, add ledgerFingerprint to the DynamicReport query's
   businessTransactionsSum and `fingerprint` to DynamicReportSnapshot.values. In utils/snapshot.ts,
   widen BusinessSumLike with `ledgerFingerprint: string` and emit the fingerprint.
7. Run yarn generate, yarn test, the server typecheck, and client tsc --noEmit. Commit.
```

### Step 4: Fingerprint on report leaves and the `records` diff kind

Context: this makes fingerprints visible. An edit that nets to ₪0 now gets an "edited" marker,
which later explains every derived PENDING.

```text
Goal: carry the current fingerprint on report leaves and flag leaves whose records changed while
their total didn't.

1. Tests first:
   - __tests__/report-tree.test.ts: buildReportTree sets data.fingerprint from the business sum. A
     hidden leaf has no fingerprint.
   - __tests__/legacy-migration.test.ts: the same for migrateLegacyTemplateNodes.
   - __tests__/template-serialization.test.ts: serializeReportTree never emits `fingerprint`.
   - __tests__/diff.test.ts: buildReportDiff emits { kind: 'records' } for a leaf present in both
     trees, with a value delta below DELTA_THRESHOLD and a baseline fingerprint that differs from
     the current one. It emits nothing when the baseline fingerprint is missing (a legacy
     snapshot). It never emits 'records' together with 'value'.
2. utils/types.ts: add `fingerprint?: string` to CustomData, with a runtime-only doc comment like
   isHidden's.
3. Set the fingerprint in utils/report-tree.ts buildReportTree and in
   utils/legacy-migration.ts. Widen their business-sum parameter types to include
   ledgerFingerprint.
4. Check utils/template-serialization.ts. If it copies `data` wholesale, strip `fingerprint`
   explicitly.
5. index.tsx Effect 2 (the value patch):
   - Build fingerprintById alongside sumById.
   - Include the fingerprint in the unchanged short-circuit and in the patched data.
   - Delete the fingerprint when the leaf is hidden.
   Add a case to __tests__/tree-sync.test.ts if that test covers the patch logic. Otherwise extract
   the patch into a pure function in utils/tree-sync.ts, call it from Effect 2, and test that.
6. utils/diff.ts:
   - Add `fingerprints: Map<string, string>` to Baseline.
   - Add `| { kind: 'records' }` to NodeChange.
   - In the leaf branch of buildReportDiff: when |delta| < DELTA_THRESHOLD and
     baseline.fingerprints.get(id) exists and differs from node.data.fingerprint, record
     { kind: 'records' }.
7. index.tsx: build baseline.fingerprints from snapshot.values (the entries whose fingerprint is
   non-null).
8. diff-markers.tsx: explain() returns 'Ledger records changed — total unchanged'. marker()
   returns 'edited' for 'records', ranked after 'renamed'.
9. Run yarn test, client tsc --noEmit and yarn lint. Commit.
```

---

## Phase 2 — Baseline selection

### Step 5: Default baseline is the newest comparable snapshot

Context: approvals will follow the baseline, so "Last save" must mean the last save for this
period and owner.

```text
Goal: default the diff baseline to the newest snapshot matching the current from/to/scopeOwner.

1. Server: in reports/typeDefs/dynamic-report.graphql.ts, add `scopeOwnerId: UUID!` to
   DynamicReportSnapshotMeta. Resolve it from snapshot.scope_owner_id; the meta query already
   selects that column.
2. Tests first, in __tests__/baseline.test.ts (new), for a pure function in utils/baseline.ts:
     pickLatestBaselineId(snapshots, { fromDate, toDate, scopeOwnerId }): string | null
   It returns the first (newest) snapshot that matches all three. If none match it falls back to
   snapshots[0]?.id, and it returns null for an empty list.
3. Implement it. In index.tsx:
   - Add scopeOwnerId to the DynamicReportTemplate snapshots selection.
   - Replace `latestBaselineId = snapshots[0]?.id ?? null` with pickLatestBaselineId(...).
   - handleBaselineChange keeps clearing the param when the latest is picked.
4. toolbar.tsx: the "Last save · …" label currently marks index 0. Pass latestBaselineId down and
   label the matching item instead. Keep the rest of the picker unchanged.
5. Add a case to __tests__/search-params.test.ts only if the params behaviour changed; it shouldn't.
   Run yarn generate, yarn test and client tsc. Commit.
```

---

## Phase 3 — Server approvals

### Step 6: Stamping helper

Context: the audit rules (carry forward, user stamp, system stamp) are the subtlest logic in the
feature, so they get a pure helper with thorough tests. Its caller lands in step 7. The two steps
are kept apart only to keep this review small, and step 7 must follow immediately.

```text
Goal: implement and exhaustively test the approval stamping rules.

1. Tests first, in reports/helpers/__tests__/dynamic-report-approvals.helper.test.ts, for:
     stampApprovals({ incoming, incomingFingerprints, leafIds, previous, userId, now })
   where
     incoming: { entityId: string; status: 'APPROVED' | 'PENDING' | 'UNAPPROVED' }[]
     incomingFingerprints: Record<string, string>
     leafIds: Set<string>
     previous: { approvals: LeafApprovals; fingerprints: Record<string, string> } | null
   and it returns
     LeafApprovals = Record<string, { status; setBy: string | null; setAt: string; system: boolean }>.
   Cases:
   - Same status as previous: carry the previous stamp unchanged.
   - New status: { setBy: userId, setAt: now, system: false }.
   - Previous APPROVED, incoming PENDING, fingerprint changed: { setBy: null, system: true }.
   - Previous APPROVED, incoming PENDING, same fingerprint: a user stamp (a manual change).
   - UNAPPROVED with no previous entry: omitted.
   - APPROVED to UNAPPROVED: kept, with a user stamp.
   - An entity not in leafIds: dropped.
   - previous === null: every non-UNAPPROVED entry gets a user stamp.
2. Implement it in reports/helpers/dynamic-report-approvals.helper.ts, and export the
   LeafApprovals type from reports/types.ts.
3. Also add parseLeafApprovals(raw: unknown): LeafApprovals to the same file. It uses zod and
   returns {} for null or invalid input. Test it.
4. Run yarn test. Do not commit yet: continue straight into Step 7 and commit the two steps
   together, so the helper never lands without its caller.
```

### Step 7: Write path — stamped approvals on Resave and Capture

Context: the server now accepts and stores approvals. The input is optional, so the current client
keeps working unchanged.

```text
Goal: the updateDynamicReportTemplate and captureDynamicReportBaseline mutations store stamped
approvals and a real created_by. insertDynamicReportTemplate stores none.

1. GraphQL (reports/typeDefs/dynamic-report.graphql.ts):
     input DynamicReportLeafApprovalInput { entityId: UUID!, status: AccountantStatus! }
   and add `approvals: [DynamicReportLeafApprovalInput!]` (optional) to
   DynamicReportSnapshotInput. AccountantStatus comes from the accountant-approval module and is
   already in the merged schema.
2. zod (dynamic-report.helper.ts): add `approvals` as an optional array of
   { entityId: uuid, status: enum }, and reject duplicate entityIds. Add tests for both.
3. Provider (dynamic-report.provider.ts):
   - Add a getLatestComparableSnapshot SQL query: SELECT * … WHERE owner_id, template_name,
     from_date, to_date and scope_owner_id match, ORDER BY created_at DESC LIMIT 1. Expose it as a
     method that takes an optional client, so it can run inside a transaction.
   - Change updateTemplateWithSnapshot to accept `buildSnapshot?: (previous) => snapshotParams`
     instead of a prebuilt snapshot. Inside the transaction it calls
     getLatestComparableSnapshot(client), then buildSnapshot(previous), then insertSnapshot. That
     way the stamp is computed against the row this insert actually follows.
   - Add captureSnapshot({ key, buildSnapshot }) with the same transactional shape, for the
     capture mutation.
   - insertTemplateWithSnapshot keeps its current shape.
4. Resolver (dynamic-report.resolver.ts):
   - Get the user id from AuthContextProvider.getAuthContext() (see auth/providers for usage) and
     set createdBy on every snapshot row.
   - Update and capture: buildSnapshot = previous => toSnapshotRow(..., leafApprovals:
     JSON.stringify(stampApprovals({ incoming: snapshot.approvals ?? [], incomingFingerprints,
     leafIds: leaf ids parsed from the submitted tree, previous: previous &&
     { approvals: parseLeafApprovals(previous.leaf_approvals), fingerprints:
     Object.fromEntries(recordToSnapshotFingerprints(previous.leaf_fingerprints)) }, userId,
     now: new Date().toISOString() }))).
   - Insert: leafApprovals: null, whatever the input says.
5. Tests:
   - Update the provider unit test mocks for the new SQL.
   - Extend dynamic-report-snapshots.integration.test.ts:
     (a) a capture with approvals, then a second capture: the first's stamps carry forward, and a
         change gets a new stamp;
     (b) previous APPROVED plus a changed fingerprint arriving as PENDING gives a system stamp;
     (c) insert with approvals stores null;
     (d) created_by is set;
     (e) getLatestComparableSnapshot ignores rows for other periods and owners.
6. Run yarn generate, yarn test, yarn test:integration (if a DB is available) and the server
   typecheck. Commit.
```

### Step 8: Read path — approvals on snapshot reads

```text
Goal: DynamicReportSnapshot exposes approvals, with display names.

1. GraphQL:
     type DynamicReportLeafApproval {
       entityId: UUID! status: AccountantStatus! setAt: DateTime!
       setBy: String isSystem: Boolean!
     }
   and add `approvals: [DynamicReportLeafApproval!]!` to DynamicReportSnapshot.
2. Resolver: approvals = Object.entries(parseLeafApprovals(snapshot.leaf_approvals)), mapped to
   the type. setBy resolves the stored user id to a display name (BusinessUser name ?? email).
   Find the auth module's business-users provider and use an existing batched lookup by user id.
   If there isn't one, add a DataLoader-backed method to that provider, with a unit test. Return
   null for system stamps and for users that can't be resolved.
3. Tests: in the integration test, capture with approvals, then query the resolver or provider path
   and assert the approvals come back with a display name. A legacy row with null leaf_approvals
   gives [].
4. Run yarn generate, the tests and the server typecheck. Commit.
```

---

## Phase 4 — Client approvals

### Step 9: Presentational status menu

Context: the report needs the charge-status dropdown without its mutations. Extracting it now, and
using it from the existing wrapper, means it is never orphaned.

```text
Goal: split components/common/inputs/update-accountant-status.tsx into a presentational
AccountantStatusMenu and the existing mutation wrapper.

1. Create components/common/inputs/accountant-status-menu.tsx exporting
     AccountantStatusMenu({ value, onChange, disabled, tooltip, size? }): ReactElement
   It renders the same Button + DropdownMenu, using accountantApprovalOptions (move that constant
   here and re-export it from the old file, so classification-section.tsx and
   charges-filters-form.tsx keep working). `tooltip` is an optional ReactNode shown in a Tooltip
   around the trigger. When `value` is null, render a neutral placeholder.
2. Rewrite UpdateAccountantStatus to render AccountantStatusMenu. Its behaviour (optimistic state,
   the mutations, rollback) must not change.
3. Test: a render test (createRoot + act) that AccountantStatusMenu calls onChange with each
   status, and that it does nothing when disabled. Check the charges tests
   (components/charges/__tests__) still pass.
4. Run yarn test, client tsc and lint. Commit.
```

### Step 10: Read-only statuses in the report tree

Context: the approval utils ship with their first caller, a read-only display of what the baseline
snapshot recorded, including derived regressions.

```text
Goal: show each leaf's effective status and each branch's derived status. No toggling yet.

1. Tests first, in __tests__/approvals.test.ts, for utils/approvals.ts:
   - deriveLeafStatuses(tree, approvals: DynamicReportLeafApproval[] | null,
     baselineFingerprints: Map<string, string>) returns Map<entityId, EffectiveApproval>, where
     EffectiveApproval = { status; setBy?; setAt?; isSystem?; isDerived? }. Cases:
     - A stored APPROVED whose baseline fingerprint differs from node.data.fingerprint becomes
       PENDING with isDerived: true.
     - A leaf with no stored entry is UNAPPROVED.
     - A null approvals list (legacy or no baseline) gives all UNAPPROVED.
     - Hidden leaves are absent from the map.
   - buildApprovalStats(nodes, statusOf) returns Map<nodeId, { approved, pending, unapproved }>.
     It is one post-order pass mirroring buildNodeStats in utils/types.ts, and it skips hidden
     leaves.
   - branchStatus(counts): UNAPPROVED if any are unapproved, else PENDING if any are pending, else
     APPROVED; null when the total is 0.
2. Implement utils/approvals.ts.
3. index.tsx:
   - Add approvals { entityId status setAt setBy isSystem } to the DynamicReportSnapshot query.
   - Memoise leafStatuses = deriveLeafStatuses(reportTree, baseline ? snapshot.approvals : null,
     baseline?.fingerprints ?? new Map()). Only a comparable baseline counts.
   - Memoise approvalStats. Pass both to the report TreePanel only.
4. New dynamic-report/approval-status.tsx with two components. Both are disabled for now (no
   onChange yet):
   - LeafApprovalStatus: an AccountantStatusMenu whose tooltip shows "Approved by X · date",
     "Returned to pending · ledger changed after approval · date" for system stamps, or nothing.
   - BranchApprovalStatus: an AccountantStatusMenu showing branchStatus with the counts tooltip
     "7 approved · 2 pending · 1 unapproved". It renders nothing when branchStatus is null.
5. tree-panel.tsx and tree-node.tsx: thread optional `approval` props the same way `rowDiff` is
   threaded. Render them in a fixed-width slot (for example `w-7`) at the far right of report rows
   only. Ghost rows and the bank tree get nothing.
6. Test: a render test that a report leaf row shows the status trigger and a bank row doesn't.
   Run yarn test, client tsc and lint. Commit.
```

### Step 11: Staged leaf toggles

```text
Goal: the user can change a leaf's status. The change is staged as an unsaved edit and is not
persisted yet.

1. Tests first, in approvals.test.ts:
   - applyOverride(overrides, entityId, status, derived) returns a new Map. It deletes the key when
     the status equals the derived status.
   - resolveStatus(entityId, derived, overrides) returns the override if there is one, otherwise
     the derived status.
2. index.tsx:
   - Add `approvalOverrides` state (a Map) and a memoised effectiveStatuses built from
     leafStatuses + overrides via resolveStatus.
   - The stats from step 10 now use the effective statuses.
   - hasStagedApprovals = overrides.size > 0. The dirty indicator and the template-switch
     confirmation use isDirty || hasStagedApprovals.
   - Clear the overrides in applyTemplate.
   - approvalsReadOnly = !currentTemplate || activeBaselineId !== latestBaselineId.
3. LeafApprovalStatus gets onChange, and is disabled when approvalsReadOnly, with a tooltip
   explaining why: "Load a saved template" or "Viewing an older baseline — switch to Last save to
   review". A staged leaf's tooltip reads "Unsaved change".
4. Test: approvals.test.ts covers the logic. Add a small render test that choosing a status on a
   leaf flips the "Unsaved changes" indicator, if index.tsx is practical to render. If it isn't,
   leave the tests at the util level.
5. Run yarn test, client tsc and lint. Commit.
```

### Step 12: Persist staged statuses on Resave and Capture

```text
Goal: Resave and Capture baseline send the effective statuses, the server stamps them, and the
report reloads showing them.

1. Tests first:
   - approvals.test.ts: buildApprovalsInput(tree, effectiveStatuses) returns
     { entityId, status }[] for every counted (non-hidden) leaf, UNAPPROVED included.
   - snapshot.test.ts: buildSnapshotInput({ …, approvals }) includes approvals when given and
     omits the key when undefined.
2. utils/snapshot.ts: accept an optional approvals argument.
3. index.tsx:
   - snapshotInput for handleResave and handleCaptureBaseline includes
     buildApprovalsInput(reportTree, effectiveStatuses).
   - SaveAsNewTemplateDialog receives a snapshot *without* approvals. Build a second memo for it,
     so Save as new and Duplicate start clean on the client too.
   - On success, clear approvalOverrides next to the existing setIsDirty(false) and refetch. On
     failure, keep them.
4. Manual check, which you should describe in the commit body: approve a leaf, Resave, reload. The
   tooltip shows "Approved by <you> · today".
5. Run yarn test, client tsc and lint. Commit.
```

### Step 13: Bulk set from a branch

```text
Goal: choosing a status on a branch stages it for every counted leaf in its subtree.

1. Tests first, in approvals.test.ts: countedLeafIds(nodes, rootId) returns the non-hidden
   financial-entity descendants, built on getDescendantIds from utils/types.ts. applyBulk(overrides,
   leafIds, status, derived) applies applyOverride to each. Cover nested branches and hidden
   leaves.
2. BranchApprovalStatus gets onChange and is disabled under the same rules as leaves. index.tsx
   handles it with applyBulk.
3. Run yarn test, client tsc and lint. Commit.
```

### Step 14: Save review replaces Capture baseline

```text
Goal: add a "Save review" action that writes only a snapshot. It is available whenever staged
statuses are the only unsaved change, on locked or unlocked templates.

1. index.tsx: canSaveReview = !!currentTemplate && hasStagedApprovals && !isDirty. The locked
   template's baseline capture (no baseline yet) stays reachable, so compute
   canCaptureBaseline = isLocked (today's behaviour). Both call handleCaptureBaseline.
2. toolbar.tsx:
   - Rename the locked-only "Capture baseline" menu item to "Save review".
   - Show it when isLocked || canSaveReview, and enable it when isLocked || canSaveReview.
   - When canSaveReview, also show a primary "Save review" button next to the "Unsaved changes"
     indicator.
   - Keep Resave as it is: it saves structure and statuses together.
3. Test: if toolbar.tsx has or can reasonably get a render test, cover the visibility matrix
   (locked, unlocked with only approvals staged, unlocked with structural edits). Otherwise
   extract a pure saveActions({ isLocked, isDirty, hasStagedApprovals, hasTemplate }) helper, test
   it, and use it in the toolbar.
4. Run yarn test, client tsc and lint. Commit.
```

### Step 15: Discard prompt when the scope changes

```text
Goal (spec R13): changing the period, owner or pinned baseline while statuses are staged asks
before discarding them.

1. Create dialogs/discard-approvals-confirmation.tsx, modelled on
   dirty-template-switch-confirmation.tsx. It is a controlled dialog with onConfirm and onCancel.
2. index.tsx: add a small `guardScopeChange(apply: () => void)` helper. If hasStagedApprovals, it
   stores `apply` and opens the dialog. Confirm clears the overrides and runs `apply`; cancel does
   nothing. Otherwise it runs `apply` straight away. Wrap handlePeriodConfirmed,
   handleFromDateChange, handleToDateChange, setSelectedOwner (as passed to the Toolbar) and
   handleBaselineChange with it.
3. Test: extract the decision into a pure function if needed. At minimum, test guardScopeChange's
   logic as a hook-free helper (it takes hasStaged, open and apply callbacks).
4. Run yarn test, client tsc and lint. Commit.
```

---

## Phase 5 — Report-level UI and rollout

### Step 16: Toolbar progress line

```text
Goal: the toolbar shows "124 / 150 approved · 6 pending" for the report.

1. Tests first, in approvals.test.ts: summarizeApprovals(effectiveStatuses) returns
   { approved, pending, unapproved, total }, and formatApprovalProgress(summary) returns the
   string. Omit the "· N pending" part when there are none, and return null when total is 0.
2. Pass the summary to Toolbar and render it as muted text near the baseline picker.
3. Run yarn test, client tsc and lint. Commit.
```

### Step 17: Needs review filter

```text
Goal: a "Needs review" switch, persisted as ?review=1, shows only non-approved counted leaves and
their ancestors, force-expanded. The template's saved isOpen is never touched.

1. Tests first:
   - search-params.test.ts: writeParam(p, 'review', '1') sets the param and clearing removes it.
     selectTemplateParams keeps `review`.
   - approvals.test.ts: needsReviewVisibility(nodes, statusOf) returns { visibleIds, forceOpenIds }.
     Visible means non-approved counted leaves plus all their ancestors. forceOpenIds are those
     ancestors. A fully approved subtree is excluded.
2. index.tsx: read `review` from searchParams, pass reviewOnly and a setter to Toolbar (a Switch
   next to "Show zeroed"), and pass the visibility sets to the report TreePanel.
3. tree-panel.tsx renderSubtree:
   - Skip nodes not in visibleIds when filtering. Ghost rows stay visible only when an ancestor is
     visible.
   - Treat `node.data.isOpen || forceOpenIds.has(node.id)` as open.
   - Branch sums still come from the unfiltered nodeStats.
4. Test: a render or pure test showing that toggling the filter never changes the result of
   serializeReportTree(reportTree).
5. Run yarn test, client tsc and lint. Commit.
```

### Step 18: CSV Status column

```text
Goal: the CSV export includes each row's status.

1. Extract the CSV row building in index.tsx handleDownloadCSV into
   utils/csv.ts: buildReportCsv(reportTree, nodeStats, statusOf, branchStatusOf): string.
2. Tests first, in __tests__/csv.test.ts: the header is 'Name,Value (ILS),Depth,Status'. A leaf
   row has its effective status, a branch row its derived status (empty when null), and hidden
   leaves are skipped as today.
3. Call it from handleDownloadCSV.
4. Run yarn test, client tsc and lint. Commit.
```

### Step 19: Final verification and follow-up issue

```text
Goal: prove the whole feature end to end, and open the annual-audit follow-up.

1. Run the full suite: yarn generate, yarn lint, yarn prettier:check, yarn test,
   yarn test:integration (with a DB), yarn workspace @accounter/server typecheck, and client
   tsc --noEmit. Fix anything red.
2. Walk through the manual acceptance list in spec.md ("Manual acceptance"), items 1–9, against
   yarn server:dev + yarn client:dev. Record the results in the PR description.
3. grep for leftovers: no unused exports in utils/approvals.ts, utils/baseline.ts or
   dynamic-report-approvals.helper.ts, and no TODOs added by this work.
4. Open a GitHub issue titled "Dynamic report approvals in the annual audit flow", using the
   content listed under "Rollout" step 3 of spec.md. Link it from the PR description.
```

## Dependency map

```
1 ─► 2 ─► 3 ─► 4
            └─► 5 ─► 6 ─► 7 ─► 8 ─► 9 ─► 10 ─► 11 ─► 12 ─► 13
                                                   └─► 14 ─► 15
                                             10 ─► 16 ─► 17
                                             10 ─► 18
                                          all ─► 19
```

Steps 13–18 only depend on 10–12. They can land in any order after that, but the numbered order
keeps each diff small and reviewable.
