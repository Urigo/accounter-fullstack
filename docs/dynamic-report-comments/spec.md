# Dynamic report: comments layer

## Context

The dynamic report (`packages/client/src/components/reports/dynamic-report/`) has grown four layers
in a few months:

| Layer                      | Source of truth                                                                                  | Write model                                                                     | Client code                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Skeleton** (template)    | `dynamic_report_templates.template`, JSON as text, PK `(owner_id, name)`                         | Resave / Save as new                                                            | `report-tree.ts`, `bank-tree.ts`, `template-serialization.ts`, effects 1 and 2 in `index.tsx` |
| **Amounts**                | Live `businessTransactionsSumFromLedgerRecords` per period and owner                             | None (read-only)                                                                | `buildNodeStats` (post-order rollup)                                                          |
| **Ledger change tracking** | `dynamic_report_template_snapshots` (tree, `leaf_values`, `leaf_fingerprints`), one row per save | Written with each save                                                          | `utils/diff.ts`, `diff-markers.tsx`, ghost rows                                               |
| **Accountant approvals**   | `leaf_approvals` jsonb in the snapshot row, keyed (template, entity, period, owner)              | Staged until Resave or Save review, stamped server-side in the save transaction | `utils/approvals.ts`, `approval-status.tsx`, Needs review overlay                             |

We now want a fifth layer: **comment threads** on any report node (leaf or branch). A thread holds
notes, open questions and discussion. Each message has free-text content, a date and the author's
name, and messages are ordered by creation.

The question asked is how to fit this in: layer it on top, or first rethink the whole structure.
This document plans both and recommends one. It follows the approvals spec (proposed in
[#4518](https://github.com/Urigo/accounter-fullstack/pull/4518) as
`docs/dynamic-report-accountant-approval/spec.md`) and the change-tracking plan in
[`docs/dynamic-report-change-tracking/`](../dynamic-report-change-tracking/plan.md).

### Decisions

| Aspect                  | Decision                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Thread scope            | **One thread per (template, node), across all periods.** Each message records the period and owner it was written for. A message from another period than the one on screen shows a period chip. |
| Lifecycle               | Threads can be **resolved and reopened**. Authors can **edit** and **soft-delete** their own messages, and `edited` / `deleted` markers stay visible.                                            |
| Save as new / Duplicate | **Start clean.** Threads are not copied, as with approvals (R14).                                                                                                                                |
| Delivery                | One PR per phase (see [Recommendation](#recommendation-a-preceded-by-a-behaviour-preserving-slice-of-bs-client-work-phase-0)).                                                                   |

### Facts from the code that shape the design

- **Templates have no surrogate key.** Rows hang off a template through the composite FK
  `(owner_id, template_name) → dynamic_report_templates (owner_id, name) ON UPDATE CASCADE ON DELETE CASCADE`,
  which is how snapshots survive a rename.
  - Annual audit step 09 references a template by name inside `evidence_json`. That is a soft
    reference, with no FK behind it.
- **Node ids are client-generated. They are stable per template, not globally:**
  - Leaves use the entity UUID.
  - Synthetic branches use `branch-<uuid>`.
  - Sort-code branches use `${owner_id}|${key}`.
  - Legacy branches can have small integer ids.
  - Save as new copies the ids unchanged.
  - So an anchor must be `(owner_id, template_name, node_id)`.
- **No comment or thread feature exists anywhere yet.**
  - The closest precedent for an authored, append-only row is `audit_logs`.
  - Authors come from `getActingUserId(injector)` in `auth/helpers/acting-user.helper.ts`, which
    returns null for API keys.
  - Display names come from `BusinessUsersProvider.getUserDisplayNamesLoader`, exactly as
    `DynamicReportSnapshot.approvals.setBy` resolves them.
- **Refetching the template query rebuilds the tree.** Effect 1 in `index.tsx` depends on
  `templateNodesData`, so a refetch wipes any unsaved drags and renames. Comments must therefore be
  fetched through their **own query**, never as a field on `DynamicReportInfo`.
- **The client installs no urql cache.** Every mutation needs an explicit `network-only` refetch of
  what it changed.
- **Two catalog tests police new tables:**
  - `migrations/src/__tests__/rls-all-tables.test.ts`: a table with `owner_id` must have RLS enabled
    and forced, and a `tenant_isolation` policy.
  - `uuidv7-id-defaults.test.ts`: uuid columns default to `uuidv7()`, never `gen_random_uuid()`.
- **Comments differ from approvals in their write model:**
  - Posting a message is communication. It must take effect immediately, on locked templates too,
    without Save.
  - Staging it until Resave would lose it on navigation.
  - Writing a snapshot per message would rebase the diff for every other leaf. That is the same
    argument the approvals spec used against per-click snapshots.
  - So comments must **not** live in snapshots, under either approach below.

---

## The current structure, and where it hurts

Every layer on the client is the same eight-part recipe, hand-wired each time:

1. A data source (a query).
2. A per-node derivation.
3. A rollup to branches.
4. A row renderer.
5. A toolbar contribution.
6. A visibility overlay.
7. A CSV column.
8. Staged or dirty state, plus a scope guard.

Pain points:

1. **`index.tsx` is a 1,250-line god component.** It holds:
   - URL and period state;
   - tree effects 1 and 2 and DnD;
   - the baseline and the diff;
   - approvals (derive, stage, save-time resolution);
   - the save handlers;
   - ten dialogs.
2. **Props are drilled per layer.**
   - `TreePanel` builds `rowDiff` and `rowApproval` closures.
   - `TreeNodeRow` takes `diff` and `approval` and renders them separately in the branch layout and
     in the leaf layout.
   - Each layer adds about five props on each hop.
3. **Three separate post-order walks** do the same job: `buildNodeStats`, `buildApprovalStats` and
   the diff's `subtreeDelta`. There is also an ancestor walk in `needsReviewVisibility`.
4. **The "review scope" (template, from, to, owner) is implicit.** It is re-derived in:
   - `isBaselineComparable`;
   - `pickLatestBaselineId`;
   - `deriveSaveStatuses`;
   - the server's `getLatestComparableSnapshot`.
5. **Template identity is its name.** Rename relies on the FK cascade, and annual audit holds the
   name as a string.
6. **Possible latent bug, unverified.** A sort-code branch placed in the report is rebuilt in the
   bank under the same id (`buildInitialBankTree` excludes only leaf ids). Dragging it in again may
   duplicate an id, and two rows would then share one thread.

---

## Approach A: layer comments on top of the current structure

### Data model

New migration `packages/migrations/src/actions/2026-09-28T10-00-00.dynamic-report-comments.ts`,
registered at the end of `MIGRATIONS` in `run-pg-migrations.ts`. It is forward-only like its
neighbours.

```sql
CREATE TABLE accounter_schema.dynamic_report_threads (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_id      uuid NOT NULL,
  template_name text NOT NULL,
  node_id       text NOT NULL CHECK (char_length(node_id) BETWEEN 1 AND 200),
  node_kind     text NOT NULL CHECK (node_kind IN ('leaf', 'branch')),
  node_label    text NOT NULL,           -- last known row text, for detached threads
  resolved_at   timestamptz,
  resolved_by   uuid,
  created_at    timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT dynamic_report_threads_template_fk FOREIGN KEY (owner_id, template_name)
    REFERENCES accounter_schema.dynamic_report_templates (owner_id, name)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT dynamic_report_threads_node_unique UNIQUE (owner_id, template_name, node_id),
  CONSTRAINT dynamic_report_threads_owner_id_unique UNIQUE (owner_id, id)
);

CREATE TABLE accounter_schema.dynamic_report_comments (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_id       uuid NOT NULL,
  thread_id      uuid NOT NULL,
  author_id      uuid NOT NULL,          -- acting user; no FK, like snapshots.created_by
  content        text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 10000),
  from_date      date NOT NULL,          -- the view the message was written in
  to_date        date NOT NULL,
  scope_owner_id uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  edited_at      timestamptz,
  deleted_at     timestamptz,
  CONSTRAINT dynamic_report_comments_thread_fk FOREIGN KEY (owner_id, thread_id)
    REFERENCES accounter_schema.dynamic_report_threads (owner_id, id) ON DELETE CASCADE
);
CREATE INDEX dynamic_report_comments_thread_index
  ON accounter_schema.dynamic_report_comments (thread_id, created_at, id);
```

- **RLS:** copy `2026-09-02T10-30-00.rls-dynamic-report-template-snapshots.ts` verbatim for both
  tables: ENABLE and FORCE, then `tenant_isolation`, `tenant_isolation_delete` and
  `tenant_isolation_update`.
- **Why a thread row:** it carries the resolved state, owns the unique anchor, lists cheaply per
  template, and is the single cascade point.
- **Resulting behaviour:**
  - A template rename keeps its threads, through the cascade.
  - Deleting a template drops them.
  - Save as new starts clean, because the key includes the name.
  - Moving a node keeps its thread, because the key is the node id.
  - A removed leaf that is re-added gets its thread back.

### GraphQL

New file `reports/typeDefs/dynamic-report-comments.graphql.ts`. Every field carries
`@requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])`, like the rest of the
module.

```graphql
enum DynamicReportNodeKind {
  LEAF
  BRANCH
}

type DynamicReportThread {
  id: UUID!
  nodeId: String!
  nodeKind: DynamicReportNodeKind!
  nodeLabel: String!
  createdAt: DateTime!
  resolvedAt: DateTime
  " display name; null when the user is gone "
  resolvedBy: String
  " oldest first (created_at, id) "
  messages: [DynamicReportComment!]!
}
type DynamicReportComment {
  id: UUID!
  " null once deleted "
  content: String
  createdAt: DateTime!
  editedAt: DateTime
  deletedAt: DateTime
  " display name (BusinessUser name ?? email); null → 'a former user' "
  author: String
  isMine: Boolean!
  fromDate: TimelessDate!
  toDate: TimelessDate!
  scopeOwnerId: UUID!
}
input AddDynamicReportCommentInput {
  templateName: String!
  nodeId: String!
  nodeKind: DynamicReportNodeKind!
  nodeLabel: String!
  content: String!
  fromDate: TimelessDate!
  toDate: TimelessDate!
  scopeOwnerId: UUID!
}
extend type Query {
  dynamicReportThreads(templateName: String!): [DynamicReportThread!]!
    @requiresAuth
    @requiresAnyRole(roles: ["business_owner", "accountant"])
}
extend type Mutation {
  addDynamicReportComment(input: AddDynamicReportCommentInput!): DynamicReportThread!
    @requiresAuth
    @requiresAnyRole(roles: ["business_owner", "accountant"])
  editDynamicReportComment(id: UUID!, content: String!): DynamicReportComment!
    @requiresAuth
    @requiresAnyRole(roles: ["business_owner", "accountant"])
  deleteDynamicReportComment(id: UUID!): DynamicReportComment!
    @requiresAuth
    @requiresAnyRole(roles: ["business_owner", "accountant"])
  setDynamicReportThreadResolved(threadId: UUID!, resolved: Boolean!): DynamicReportThread!
    @requiresAuth
    @requiresAnyRole(roles: ["business_owner", "accountant"])
}
```

The whole change is additive, so there are no breaking changes. It fetches every thread of the
template with its messages in one query. Volume per template is expected to be tens to hundreds of
messages.

### Server

In `packages/server/src/modules/reports/`:

1. **`helpers/dynamic-report-comments.helper.ts`** (pure, zod):
   - content is trimmed, then 1–10,000 chars;
   - `nodeId` is 1–200 chars;
   - `nodeLabel` is capped;
   - dates use `TIMELESS_DATE_REGEX` with `from <= to`;
   - `scopeOwnerId` uses `UUID_REGEX`.

   These are the same regexes `dynamicReportSnapshotInput` uses.

2. **`providers/dynamic-report-comments.provider.ts`**, `@Injectable({ scope: Scope.Operation })`,
   on `TenantAwareDBClient`. Its pgtyped queries:
   - `getThreadsByTemplate(ownerId, templateName)`.
   - `getCommentsByThreadIds`, behind a DataLoader.
   - `upsertThread`:
     `INSERT … ON CONFLICT (owner_id, template_name, node_id) DO UPDATE SET node_label, node_kind, resolved_at = NULL, resolved_by = NULL RETURNING *`.
     Posting a reply therefore reopens a resolved thread.
   - `insertComment`.
   - `updateCommentContent`:
     `… WHERE id AND owner_id AND author_id = $userId AND deleted_at IS NULL`, setting
     `edited_at = now()`.
   - `softDeleteComment`: the same guard, setting `deleted_at = now()`.
   - `setThreadResolved`.

   `addComment` runs the upsert and the insert in one `db.transaction`. An FK violation on the
   template maps to a `GraphQLError('Template not found')`. Loaders are invalidated after every
   write.

3. **`resolvers/dynamic-report-comments.resolver.ts`:**
   - The owner comes from `AdminContextProvider.getVerifiedAdminContext()`.
   - The author comes from `getActingUserId(injector)`. A null author, as with an API key, is
     rejected with `FORBIDDEN`: "Comments need a signed-in user".
   - An edit or delete that matches no row means "not found or not yours", and throws.
   - `author` and `resolvedBy` resolve through
     `getUserDisplayNamesLoader({ userId, businessId: owner_id })`.
   - `isMine` is `author_id === actingUserId`.
   - `content` is null when `deleted_at` is set. The text stays in the DB.
   - Errors are wrapped with `errorSimplifier`, as in `dynamic-report.resolver.ts`.
4. Register the typeDefs, resolvers and provider in `reports/index.ts`, then run `yarn generate`.

Locked templates are **not** checked: commenting is review activity, like Save review.

### Client

- **Query** `DynamicReportThreads($templateName)`. It is separate from `DynamicReportTemplate` (see
  the Effect 1 fact above), paused until a template is selected, and refetched `network-only` after
  each mutation of ours.
- **Mutation hooks** in `src/hooks/`, built on `useApiMutation`:
  - `use-add-dynamic-report-comment.ts`
  - `use-edit-dynamic-report-comment.ts`
  - `use-delete-dynamic-report-comment.ts`
  - `use-set-dynamic-report-thread-resolved.ts`

  Posting uses `successToast: false`, so a conversation doesn't spam toasts.

- **`utils/comments.ts`** (pure):
  - `indexThreads(threads) → Map<nodeId, ThreadSummary { threadId, isOpen, messageCount, lastMessageAt }>`.
  - `buildCommentStats(nodes, index) → Map<nodeId, { own?: ThreadSummary; openBelow: number }>`, a
    post-order pass that skips hidden leaves.
  - `detachedThreads(threads, tree, ghostIds) → { thread, reason: 'hidden-in-period' | 'not-in-report' }[]`.
    It covers:
    - a leaf dragged back to the bank;
    - a deleted branch;
    - a leaf with no activity in the period;
    - an unsaved branch that was discarded.
  - `ancestorIds(nodes, nodeId)`, for revealing a node.
  - `messagePeriodChip(message, view) → string | null`. It returns null when the message's period
    and owner match the view.
- **`comment-indicator.tsx`:** a fixed `w-7` slot to the left of the approval slot, on report rows
  only.
  - A row with its own thread shows `MessageSquare` and the message count. It is emphasized while
    open and muted once resolved.
  - A branch with no thread of its own but open threads below it shows a small dot, with the tooltip
    `2 open threads inside`.
  - Ghost rows show their thread read-only.
  - Clicking opens the thread.
- **`thread-sheet.tsx`:** a shadcn `Sheet` on the right, with two modes.
  - **Node mode.** The header shows the node label and its path, plus **Resolve** or **Reopen**.
    Each message shows:
    - the author, the date, and a period chip when relevant;
    - `edited` or `deleted` markers;
    - edit and delete actions on your own messages;
    - content rendered as plain text with `whitespace-pre-wrap`.

    The composer is a `Textarea`, and Cmd/Ctrl+Enter sends. A "This period only" toggle filters by
    period chip.

  - **All-discussions mode**, opened from the toolbar. Threads are grouped into **Open**,
    **Resolved** and **Not in report**. Clicking one reveals its node: its ancestors are
    force-opened through the same render-time overlay Needs review uses (never writing
    `node.data.isOpen`), and the row is scrolled into view by `data-node-id`.
- **Toolbar:** a **Discussions · N open** button.
- **Availability:** disabled with the tooltip "Save the template to start a discussion" when no
  saved template is loaded. It is **not** gated by the Edit switch, the lock, the pinned baseline or
  loading. Comments are never part of `isDirty`, `hasUnsavedChanges` or the scope guard, and a
  period change discards nothing.
- **State:** `openThreadNodeId`, the sheet mode, `revealNodeId` and per-node composer drafts, all in
  memory. The drafts are cleared on template switch.
- **`DeleteTemplateConfirmation`** mentions the thread count that will be deleted.

### Cost of Approach A

It is the fastest path: two PRs, server and then client. But it adds:

- about 150–200 lines of state and handlers to `index.tsx`, taking it past 1,400;
- a third per-layer prop set through `TreePanel`, and a third slot rendered twice in `TreeNodeRow`;
- a fourth hand-written post-order walk.

The next layer will cost more again.

---

## Approach B: complete refactor, then comments as one layer among equals

### B1. Data model

1. **Stable template identity.**
   - Add `dynamic_report_templates.id uuid NOT NULL DEFAULT uuidv7()`.
   - Move the PK to `id`, keeping `UNIQUE (owner_id, name)`.
   - Convert `template` from text to jsonb.
   - Re-key snapshots to `template_id`.
   - Change annual-audit `evidence_json.lockedTemplateName` to `lockedTemplateId`.
   - `DynamicReportInfo.id` becomes a real UUID instead of `${owner_id}-${name}`.
2. **Report scope as a first-class entity.**
   - `dynamic_report_scopes (id, owner_id, template_id, from_date, to_date, scope_owner_id, UNIQUE(template_id, from_date, to_date, scope_owner_id))`.
   - Snapshots reference `scope_id`, which replaces the four repeated key columns and the comparable
     index.
3. **Approvals as an event log.**
   - `dynamic_report_approval_events (id, owner_id, scope_id, node_id, status, fingerprint, set_by, is_system, snapshot_id, created_at)`.
   - The current status is the latest event per (scope, node).
   - Snapshots keep only values and fingerprints.
   - This gains a full toggle history, which the approvals spec left out of scope.
4. **Comments** as in A, but keyed by `template_id`.
5. **Optionally, typed node ids** (`entity:<uuid>`, `sortcode:<key>`, `branch:<uuid>`). This fixes
   the legacy integer ids and the sort-code collision, but it means rewriting every template and
   snapshot tree.

### B2. Server

- Split the dynamic report out of `reports` into a new `modules/dynamic-reports/` graphql module.
- It gets four providers: templates, snapshots, approvals, comments.
- The API is keyed by template id, with a `DynamicReport.scopes { snapshots, approvals }` shape.
- A per-node **activity timeline** union: comment | approval change | save with delta. This is the
  one user-visible gain B enables.
- The API change is breaking. The client ships in the same PR, and annual-audit steps 03, 05 and 09
  are touched too.

### B3. Client

- `index.tsx` becomes a composition root of about 250 lines, built on these hooks:
  - `useReportScope`: URL, period, owner, baseline and scope guard.
  - `useReportTrees`: effects 1 and 2, DnD, structural edits and the dirty flag.
  - `useBaselineDiff`.
  - `useApprovalLayer`.
  - `useCommentsLayer`.
- A `ReportLayer` contract:
  `{ rowSlot, rollup?, visibility?, csvColumns?, toolbarItems?, staged? }`. `TreePanel` renders
  `layers[]` without knowing any layer by name.
- One generic `rollup()` replaces `buildNodeStats`, `buildApprovalStats` and the diff's subtree
  pass.
- One `TreeNodeRow` layout for both branches and leaves, with a trailing slot column.
- The per-node side sheet shows the unified activity timeline.

### Cost of Approach B

About six to eight PRs, and it:

- migrates live data: re-keys snapshots, converts jsonb approvals to event rows, rewrites annual
  audit evidence;
- rewrites approval semantics that just shipped and are subtle:
  - stamping inside the save transaction;
  - `carryForwardApprovals`;
  - the statuses a save sends while a baseline is pinned;
  - dropping overrides after an in-flight save;
- ports 17 client test files and the server approvals, lock and snapshot tests;
- makes breaking GraphQL changes across annual audit.

Comments ship last, behind all of that.

---

## Recommendation: A, preceded by a behaviour-preserving slice of B's client work (Phase 0)

**Recommended path: Approach A for data, server and features, plus a small Phase 0 that extracts the
client "layer seam" first. B's data-model half is deferred to a follow-up issue.**

Why:

1. **Comments don't need B's data model.**
   - They are live writes, independent of snapshots, and (as decided) scoped per (template, node)
     across periods. So they need neither the report-scope entity nor the approval event log, which
     are B's main structural arguments.
   - They hang off `(owner_id, template_name)` exactly as snapshots do, and inherit the same tested
     rename and delete cascade.
   - If B is done later, it re-keys one more FK. That is a marginal cost.
2. **The real debt is client composition, and comments are what justify paying it now.**
   - This is the third per-row layer, the classic rule-of-three moment.
   - Extracting the seam first, as a no-behaviour-change PR, lets the existing 17 test files prove
     nothing moved, and keeps the comments PR small and reviewable.
3. **B puts freshly merged, subtle approval code at risk for no user-visible gain today.**
   - It means re-keying live data and annual-audit evidence.
   - Its one tangible feature, the per-node activity timeline, is not in the request.
4. **The repo convention is small, focused, squash-merged PRs.** A plus Phase 0 is four such PRs.
5. **When B becomes worth it, the triggers are:**
   - approval history, or a unified per-node timeline;
   - per-period review progress in annual audit;
   - id-based template references.

   The follow-up issue records these triggers.

### Phase 0: client layer seam (one PR, no behaviour change)

1. **`utils/rollup.ts`:**
   `rollup<T>(nodes, leaf: (n) => T | null, combine: (acc: T, child: T) => T, empty: () => T): Map<string, T>`.
   Re-implement `buildNodeStats` (`utils/types.ts`) and `buildApprovalStats` (`utils/approvals.ts`)
   on top of it, keeping their signatures and tests. Add `__tests__/rollup.test.ts`.
2. **Row annotations.**
   - `TreePanel` replaces the `rowDiff` and `rowApproval` closures with
     `rowAnnotations(node) → RowAnnotations { diff?: RowDiff; approval?: RowApproval }`.
   - `TreeNodeRow` takes `annotations` and renders one shared `<RowTrailing>` in both layouts: diff
     markers, value badge, controls, then the fixed-width slots.
   - Adding a layer then means one field and one slot.
3. **Hooks out of `index.tsx`,** into `dynamic-report/hooks/`, as pure moves:
   - `useBaselineDiff`: today's lines 468–529 and 595–604.
   - `useApprovalLayer`: lines 531–593 and 855–908, meaning the derive, stage, disabled-reason and
     `resolveSaveApprovals` logic.
4. **Generalise `ReviewVisibility`** into
   `RowVisibility { visibleIds: Set | null; forceOpenIds: Set }`, with a `mergeVisibility` helper so
   the thread reveal can compose with Needs review.
5. **Check the suspected duplicate sort-code-branch id** with a test in
   `__tests__/cross-tree-drop.test.ts`. If it is real, fix it in its own commit.

### Phase 1: server (one PR)

The migration, typeDefs, helper, provider and resolver described under **Approach A**, with their
tests.

### Phase 2: client (one PR)

The query, hooks, `utils/comments.ts`, `comment-indicator.tsx`, `thread-sheet.tsx`, the toolbar
button and the delete-confirmation copy described under **Approach A**. They plug in through the
Phase 0 seam: a `comments` field on `RowAnnotations`, and `buildCommentStats` built on `rollup()`.

### Phase 3: follow-ups (issues, not code)

- "Dynamic report: stable template ids and report scopes": B1 and B2, with the triggers above.
- Out of scope for now:
  - notifications and @mentions;
  - live updates (refetch happens on open and on post only);
  - rich text and attachments;
  - comments in the bank tree;
  - a CSV comments column;
  - a Needs review filter that includes open threads;
  - annual-audit integration.

---

## Verification

**Server unit (`yarn test`):**

- `dynamic-report-comments.helper.test.ts`:
  - content is trimmed;
  - empty content, content over 10k chars and bad dates are rejected;
  - `from > to` is rejected.
- Resolver:
  - an API-key caller is rejected;
  - `content` is null when deleted;
  - `isMine` is computed correctly.

**Server integration (`yarn test:integration`, DB up and migrated).** Follow
`providers/__tests__/dynamic-report-lock.provider.test.ts`:

- Add → list returns messages ordered by `(created_at, id)`, with the author's display name.
- A second post on the same node reuses the thread.
- A post on a resolved thread reopens it.
- Edit and delete work for the author only. Someone else's message gives "not found".
- Delete is soft.
- A template rename keeps its threads, and a delete cascades them.
- `insertDynamicReportTemplate` (Save as new) has no threads.
- Commenting works on a locked template.
- Another tenant can't read a thread or write to it (RLS).
- The catalog tests `rls-all-tables.test.ts` and `uuidv7-id-defaults.test.ts` pass.

**Client (`yarn test:client` after `yarn generate`, plus `tsc --noEmit`):**

- Phase 0:
  - all 17 existing test files pass unchanged, and the test count doesn't drop;
  - new `rollup.test.ts`.
- `__tests__/comments.test.ts`:
  - index;
  - `openBelow` rollup, with hidden leaves skipped;
  - detached reasons: hidden, bank, deleted branch;
  - ancestor reveal;
  - the period chip shows only on a mismatch.
- A thread-sheet render test, done by hand with `createRoot` + `act` since there is no
  testing-library.

**Commands before pushing:**

- `yarn generate`, `yarn lint`, `yarn prettier:check`, `yarn test`
- `yarn workspace @accounter/server typecheck`
- client `tsc --noEmit`

**Manual acceptance (`yarn server:dev` + `yarn client:dev`):**

1. Load a template and comment on a leaf and on a collapsed branch's child. The branch shows a dot
   with an "open threads inside" tooltip.
2. Reply as a second user. Messages are ordered, with names and dates.
3. Edit and delete your own message. The markers show, and there is no edit on others' messages.
4. Resolve, then reply. The thread reopens.
5. Change the period (Balance Sheet vs P&L deep link). The same thread shows, with period chips.
6. Make an unsaved drag, then post a comment. The drag survives: no template refetch happens.
7. Drag a commented leaf back to the bank. It appears under "Not in report", and dragging it back
   reattaches it.
8. On a locked template, commenting works.
9. Save as new: the new template has no threads.
10. Rename the template: the threads are kept. Delete it: the confirmation mentions the threads.

---
