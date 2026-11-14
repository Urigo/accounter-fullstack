# Comment threads across Accounter: plan

Status: proposal · Scope: `packages/migrations`, `packages/server`, `packages/client` (and
optionally `packages/mcp-server`) · Builds on #4575–#4578 (dynamic-report comments), relates to
#4579 and #4580

---

## 1. Context and goals

The product wants threads and comments in more parts of Accounter: notes, open questions and
discussions. Each message has content, a date and an author name. Messages are ordered by creation,
and a thread can be resolved. The first targets are **charges, documents, transactions and business
trips**.

We have just shipped this for one area, the **dynamic report** (#4575 spec, #4576 server, #4577
client layer seam, #4578 client UI). This plan:

1. reviews that implementation, separating what generalises from what is specific to the report;
2. compares per-entity, polymorphic and hybrid architectures, and recommends one;
3. lays out small, ordered PRs covering the data model, GraphQL, server, client, tests and rollout,
   including what to do with the existing dynamic-report threads.

**Goals**

- One lifecycle (post, reply, edit, soft-delete, resolve, reopen) with one set of semantics
  everywhere.
- Real referential integrity and tenant isolation: no orphaned or cross-tenant threads.
- Threads survive the ways entities actually change: charge merges, documents and transactions
  moving between charges, automatic clean-up of empty charges, and deletions.
- UI parts that can be reused, so each new area is a small adapter and not a copy.
- Adding a sixth entity later should be cheap.

**Non-goals for now:** notifications and @mentions, live updates, rich text and attachments, putting
thread text into search, and a unified activity timeline (see §3.4).

---

## 2. Current state: the dynamic-report implementation

### 2.1 What exists

| Layer          | Files                                                                                                                                                                                                                                                                                                                    | Notes                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DDL            | `packages/migrations/src/actions/2026-09-28T10-00-00.dynamic-report-comments.ts`                                                                                                                                                                                                                                         | `dynamic_report_threads` (anchor `(owner_id, template_name, node_id)` UNIQUE, `node_kind`, `node_label`, `resolved_at/by`, `created_at clock_timestamp()`, `UNIQUE (owner_id, id)`), `dynamic_report_comments` (`author_id`, `content` CHECK 1–10k and `~ '[^[:space:]]'`, `from_date`, `to_date`, `scope_owner_id`, `edited_at`, `deleted_at`, composite FK `(owner_id, thread_id)`) |
| RLS            | `…/2026-09-28T10-30-00.rls-dynamic-report-comments.ts`                                                                                                                                                                                                                                                                   | ENABLE + FORCE, permissive `tenant_isolation` (USING read scope, WITH CHECK write target), RESTRICTIVE `tenant_isolation_delete` / `_update`                                                                                                                                                                                                                                          |
| typeDefs       | `packages/server/src/modules/reports/typeDefs/dynamic-report-comments.graphql.ts`                                                                                                                                                                                                                                        | `dynamicReportThreads(templateName)`, `add/edit/deleteDynamicReportComment`, `setDynamicReportThreadResolved`; all `@requiresAuth @requiresAnyRole(["business_owner","accountant"])`                                                                                                                                                                                                  |
| Validation     | `…/reports/helpers/dynamic-report-comments.helper.ts`                                                                                                                                                                                                                                                                    | zod `commentContent` (trim, 1–10k), `nodeId` ≤200, label capped at 500 code points, date regexes, `visibleCommentContent`, `isCommentByUser`                                                                                                                                                                                                                                          |
| Data access    | `…/reports/providers/dynamic-report-comments.provider.ts`                                                                                                                                                                                                                                                                | `Scope.Operation, global: true`; upsert-thread-then-insert in one `db.transaction`; `ON CONFLICT … SET resolved_at = NULL` (posting reopens); edit and delete guarded by `author_id` and `deleted_at IS NULL` in the WHERE; `setThreadResolved` keeps the original stamp (`COALESCE(resolved_at, clock_timestamp())`); a template FK violation maps to `NOT_FOUND`                    |
| Resolvers      | `…/reports/resolvers/dynamic-report-comments.resolver.ts`                                                                                                                                                                                                                                                                | owner from `AdminContextProvider.getVerifiedAdminContext()`; `requireActingUserId` → `FORBIDDEN` for API keys; one `NOT_FOUND` for "missing / deleted / not yours"; names via `BusinessUsersProvider.getUserDisplayNamesLoader({ userId, businessId })`; `errorSimplifier` passes coded `GraphQLError`s through                                                                       |
| Client (pure)  | `packages/client/src/components/reports/dynamic-report/utils/comments.ts`                                                                                                                                                                                                                                                | `indexThreads`, `buildCommentStats` (on `rollup()`), `detachedThreads`, `ancestorIds`, `nodePath`, `revealVisibility`, `messagePeriodChip`, `isSendable`, `groupDiscussions`                                                                                                                                                                                                          |
| Client (UI)    | `thread-view.tsx` (509 lines: header, messages, composer, edit, delete confirm), `discussions-list.tsx`, `thread-sheet.tsx` (thin container), `comment-indicator.tsx` (tree row slot), `hooks/use-comments-layer.ts` (524 lines), stories                                                                                | Presentational components plus thin containers                                                                                                                                                                                                                                                                                                                                        |
| Client (hooks) | `packages/client/src/hooks/use-{add,edit,delete}-dynamic-report-comment.ts`, `use-set-dynamic-report-thread-resolved.ts`                                                                                                                                                                                                 | `useApiMutation`; posting uses `successToast: false` plus `toast.dismiss` on success                                                                                                                                                                                                                                                                                                  |
| Tests          | server: `dynamic-report-comments.{helper,provider,resolver}.test.ts`, `dynamic-report-comments.integration.test.ts` (1.1k lines, RLS role harness); client: `comments.test.ts`, `thread-view.test.tsx`, `comment-indicator.test.tsx`, `comments-layer.test.tsx`, `comments-toolbar.test.tsx`, `reveal-collapse.test.tsx` |                                                                                                                                                                                                                                                                                                                                                                                       |

Verified while reviewing. Three corrections to the brief:

- The "lean count query" in the delete dialog is a **client-side ids-only selection**
  (`query DynamicReportThreadCount { dynamicReportThreads(templateName) { id } }` in
  `dialogs/delete-template-confirmation.tsx`). There is no dedicated server count field.
- The ordering fix `414c6476` ("order comment threads by wall clock…") is on
  `claude/vibrant-maxwell-chcwl2-comments-server` only. The client branch still carries an older
  copy of the server files. Build on `main` once all four PRs have merged.
- The #4580 workaround in `thread-view.tsx` raises only `AlertDialogContent` to `z-1002`. The
  overlay stays at `z-50`, under the sheet.

### 2.2 What generalises and what doesn't

| Generalises as is                                                                                                                                | Specific to the dynamic report                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Thread row with resolved state; message row with author, content, `created_at`, `edited_at`, `deleted_at`                                        | The anchor is a **soft reference into template JSON** (`node_id`, not FK-able), so the thread must remember `node_label` and can be "detached" |
| Lifecycle rules: posting reopens, resolve keeps its first stamp, soft delete returns null content, author-only edit and delete, API keys refused | **One thread per node** (UNIQUE anchor)                                                                                                        |
| `clock_timestamp()` ordering, `(created_at, id)` tie-break, uuidv7                                                                               | **Per-message view context** (`from_date`, `to_date`, `scope_owner_id`), with period chips and a "This period only" filter                     |
| CHECKs that mirror zod                                                                                                                           | Tree rollup (`openBelow`), reveal overlay, ghost rows, the "Not in report" group                                                               |
| RLS policy set; composite `(owner_id, id)` FKs for tenant consistency                                                                            | Owner taken from admin context, not from a subject row                                                                                         |
| Display-name resolution, `isMine`, error codes                                                                                                   | Template-rename cascade via `ON UPDATE CASCADE` on the name                                                                                    |
| A separate threads query, `network-only` refetch, silent posting, composer UX, presentational components                                         | `DeleteTemplateConfirmation` copy                                                                                                              |

---

## 3. Requirements across entities

### 3.1 Entity facts (from the code)

|                         | Charges                                                                                                                                                                                                                                                                                                                                       | Documents                                                                                                               | Transactions                                                            | Business trips                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Table and PK            | `charges.id uuid` PK                                                                                                                                                                                                                                                                                                                          | `documents.id uuid` PK                                                                                                  | `transactions.id uuid` PK                                               | `business_trips.id uuid` (unique index `business_trips_id_uindex`, no named PK) |
| `owner_id`              | NOT NULL (original)                                                                                                                                                                                                                                                                                                                           | NOT NULL since `2026-02-18T16-00-00.owner-id-not-null.ts`                                                               | same                                                                    | same                                                                            |
| `UNIQUE (owner_id, id)` | **no**                                                                                                                                                                                                                                                                                                                                        | **no**                                                                                                                  | **no**                                                                  | **no**                                                                          |
| RLS                     | forced, `tenant_isolation` (+ multi-business read scope, `2026-05-25T10-00-00`)                                                                                                                                                                                                                                                               | same                                                                                                                    | same                                                                    | same                                                                            |
| Parent link             | —                                                                                                                                                                                                                                                                                                                                             | `charge_id` nullable (`documents_charges_id_fk`)                                                                        | `charge_id` NOT NULL                                                    | `business_trip_charges(charge_id → business_trip_id)`                           |
| Deleted how             | `deleteCharges()` in `charges/helpers/delete-charges.helper.ts`: explicit `deleteCharge`, merges, **automatic clean-up of emptied charges**                                                                                                                                                                                                   | `deleteDocument` (`documents.resolver.ts`); `documents_issued` cascades                                                 | Never deleted by the app (they come from scraper raw tables)            | No delete mutation                                                              |
| Merged or moved         | `mergeChargesExecutor` (`charges/helpers/merge-charges.helper.ts`) re-points docs, txs, ledger, misc expenses and trip payments, then deletes. Called from `mergeCharges`, cron `executeReferenceMergePlan` (`cron-jobs/helpers/run-cron-jobs.helper.ts:212`) and the auto-matcher (`charges-matcher.provider.ts:460`). **Not transactional** | Moved between charges by `updateDocument` (unlinking generates a new charge and deletes the old one if it is now empty) | Same unlink pattern in `transactions.resolver.ts` (single and batch)    | Charges attached or detached via `updateChargeBusinessTrip`                     |
| Free text today         | `user_description` (charge description, used in search)                                                                                                                                                                                                                                                                                       | `description`, `remarks` (`2025-12-21…enrich-document-with-description-remarks.ts`)                                     | `source_description` (scraped, read-only)                               | `trip_purpose`                                                                  |
| Approval                | `accountant_status` enum (`UNAPPROVED/APPROVED/PENDING`) plus `degradeChargesAccountantApproval`                                                                                                                                                                                                                                              | via charge                                                                                                              | via charge                                                              | `business_trips.accountant_status`                                              |
| Read permission         | `@requiresAuth` plus RLS (`ChargesAuthorizationProvider.canReadCharges`)                                                                                                                                                                                                                                                                      | `@requiresAuth` plus RLS                                                                                                | `@requiresAuth` plus RLS                                                | `@requiresAuth` plus RLS                                                        |
| Write permission        | `@requiresAnyRole(["business_owner","accountant"])`; `canWriteCharge` also admits `gmail_listener` and `scraper`                                                                                                                                                                                                                              | same directive                                                                                                          | same                                                                    | same                                                                            |
| Provider loader         | `ChargesProvider.getChargeByIdLoader` → `T \| undefined`                                                                                                                                                                                                                                                                                      | `DocumentsProvider.getDocumentsByIdLoader` → `T \| undefined`                                                           | `TransactionsProvider.transactionByIdLoader` → `T \| Error` (narrow it) | `BusinessTripsProvider.getBusinessTripsByIdLoader`                              |

**Every charge-deleting call site** (all go through `deleteCharges`):

- `charges.resolver.ts:543`: explicit `deleteCharge`, which the user confirms.
- `merge-charges.helper.ts:69`: merge; called from the resolver, cron and the auto-matcher.
- `documents.resolver.ts:374`: document unlinked, and the old charge is now empty.
- `documents.resolver.ts:466`: `deleteDocument`, and the charge is now empty.
- `transactions.resolver.ts:154`: single transaction unlinked, and the old charge is now empty.
- `transactions.resolver.ts:285`: batch unlink.
- `deel/resolvers/deel.resolvers.ts:159`: Deel re-match left the charge empty.

### 3.2 Anchor stability

- **Anchor each thread on the entity it is about, not on its parent charge.**
  - A question about an invoice belongs to the document, and moves with it when the document is
    re-matched to another charge.
  - A charge view then shows its own threads plus the threads of its current documents and
    transactions, derived at read time through `documents.charge_id` and `transactions.charge_id`.
  - Moving a document therefore needs no thread bookkeeping.
- **Charge merge.** Charge-level threads of the merged-away charges must be re-pointed to the base
  charge before `deleteCharges`. This is the same as every other `replaceXChargeId` step in
  `mergeChargesExecutor`.
- **Automatic clean-up of an emptied charge.** When a charge's last document or transaction moves to
  a newly generated charge, the old charge's threads describe what is now the new charge. Move them
  there. A cascade here would **silently delete a discussion as a side effect of re-matching a
  document**. That is the main hazard in this area.
- **Explicit deletion** of a charge or document is confirmed by the user. Cascade the threads, and
  show the count in the confirmation, as the dynamic report does for templates.
- Transactions and business trips are not deleted today. They get an FK cascade as a backstop.

### 3.3 Permissions

- **Roles.** Read and write need `business_owner` or `accountant`, the same as the dynamic report.
  Excluded:
  - `employee`, which is read-only; widening this is open question Q2;
  - the machine roles `scraper` and `gmail_listener`.
- **Writes need an acting user.** `getActingUserId` must return non-null, otherwise the call fails
  with `FORBIDDEN`. API keys are refused.
- **The subject must be visible.** The adapter loads it through its RLS-scoped provider. If it is
  missing or invisible, the call fails with `NOT_FOUND`.
- **Owner.**
  - The thread's `owner_id` is the **subject's** `owner_id`, not the admin-context owner.
  - The composite FK enforces this.
  - RLS `WITH CHECK` then accepts the write only when that owner is the request's write target. This
    matters under multi-business read scope, where a subject can be visible but not writable.
  - Map the resulting RLS violation (SQLSTATE `42501`) or the FK violation (`23503`) to `FORBIDDEN`
    or `NOT_FOUND` with a clear message.
- **No lock or approval coupling.**
  - Commenting on a charge with a locked ledger is allowed. It is review activity, like commenting
    on a locked template.
  - Thread writes are **not** charge-composition changes. They must **not** call
    `degradeChargesAccountantApproval`.
  - Moving threads during a merge needs no extra degrade, because the merge already degrades.

### 3.4 Other consumers and adjacent systems

- **Period context.** No target entity needs the dynamic report's per-message view context.
  Documents, transactions, charges and trips are concrete records. The context stays specific to the
  dynamic report.
- **Accountant approval** (`charges.accountant_status`, `business_trips.accountant_status`). Keep it
  independent of threads in v1. Later, add a `hasOpenThreads` charge filter and an optional "approve
  with open threads?" nudge (Q4).
- **Audit and activity.**
  - `audit_logs` (`2026-01-26T12-00-00…`, `modules/common/providers/audit-logs.provider.ts`) holds
    security and auth events only, keyed by `business_id`: `INVITATION_*`, `API_KEY_*`,
    `USER_LOGIN`, and so on.
  - There is no history of charge changes, and `accountant_status` has no log either.
  - A unified activity timeline would therefore contain only threads. **Defer it**; the thread
    tables can become one source of it later.
  - Don't store comments in `audit_logs`.
- **MCP** (`packages/mcp-server`).
  - It exposes read-only tools: `accounter_get_charges`, `accounter_get_transactions`,
    `accounter_get_documents` and others.
  - Reading threads would be useful ("what's still open on this charge?").
  - Add a read-only `accounter_get_comment_threads` tool later, behind the tool allowlist
    (`src/tools/allowlist.ts`). Don't add a write tool in this plan (Q6).
- **Existing free-text fields.**
  - `charges.user_description` and `documents.description` / `remarks` are **record data**. They
    feed ledger text, search and exports.
  - Threads are **communication about** the record.
  - Keep both and migrate nothing. A "copy into description" action can come later.

---

## 4. Options

### (A) Per-entity tables and modules, copying the pattern

`charge_threads` + `charge_comments`, `document_threads` + `document_comments`, and so on, each with
RLS, a provider, a resolver, typeDefs, four hooks and UI wiring.

### (B) One shared schema with a polymorphic subject

`comment_threads(subject_type text, subject_id uuid)` + `comments`, with no FK to the subject.

- **Integrity** has to be rebuilt by hand:
  - AFTER DELETE triggers on each subject table, or periodic garbage collection;
  - adapter checks that `thread.owner_id = subject.owner_id`;
  - a merge handled in application code.
- The dynamic report's text anchor `(template_name, node_id)` with rename cascade doesn't fit a
  single uuid `subject_id`.

### (C) Hybrid: shared thread and message tables, typed per-entity anchors, shared core and client, per-entity adapters

- **C1: link tables.** `charge_comment_threads(thread_id, charge_id FK)` and so on.
  - Deleting a subject cascades the _link_ row, not the thread, which leaves an orphan unless a
    trigger removes it.
  - Nothing guarantees that a thread has exactly one link.
- **C2: exclusive arc on the thread row.** Add one nullable typed FK column per subject type
  (`charge_id`, `document_id`, `transaction_id`, `business_trip_id`) plus a `subject_type`
  discriminator.
  - A CHECK requires exactly one column to be set, and it must match `subject_type`.
  - Composite FKs `(owner_id, charge_id) → charges(owner_id, id) ON DELETE CASCADE` give native
    cascades and tenant consistency. With `MATCH SIMPLE`, a NULL column skips the check, which is
    exactly the arc semantics.
  - A stored generated `subject_id` column gives one static, indexable query path.

### Evaluation

| Criterion                                         | A: per-entity copy                                                             | B: polymorphic                                      | C1: link tables                          | **C2: exclusive arc**                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| Referential integrity                             | Real FKs                                                                       | None; triggers or GC                                | FKs, but orphan threads unless a trigger | **Real FKs**                                                                             |
| Tenant consistency (thread owner = subject owner) | Composite FK possible                                                          | Application check only                              | Composite FK on link                     | **Composite FK**                                                                         |
| Cascade semantics                                 | Native                                                                         | Hand-written triggers on 4+ subject tables          | Trigger from link to thread              | **Native**                                                                               |
| RLS                                               | 2 tables × N; each must pass the catalog tests                                 | 2 tables                                            | 2 + N tables                             | **2 tables**                                                                             |
| Merge and move                                    | N implementations                                                              | One UPDATE per type                                 | UPDATE the link                          | **One UPDATE on `charge_id`**                                                            |
| Query performance                                 | Best per entity; cross-entity views need an N-way UNION                        | One index on `(owner_id, subject_type, subject_id)` | Extra join                               | One subject index plus per-FK partial indexes for cascades; rollups are cheap UNION ALLs |
| pgtyped and codegen                               | N copies of generated types                                                    | One set                                             | One set plus N link queries              | **One set.** One static query path via `subject_id`                                      |
| GraphQL type safety                               | N type families                                                                | One family; subject type as an enum                 | One family                               | **One family**                                                                           |
| Lifecycle consistency                             | Drifts: each bug fixed N times, as the `CURRENT_TIMESTAMP` bug would have been | One implementation                                  | One                                      | **One**                                                                                  |
| Dev effort for 4 entities                         | ~4× the #4576 + #4578 effort                                                   | Lowest DDL, highest integrity work                  | Medium                                   | **Medium once, then ~1 migration plus an adapter per entity**                            |
| Adding a future entity                            | A full copy                                                                    | Adapter only (no DDL)                               | Link table plus trigger                  | 1 column, 1 FK, 1 partial index, CHECK and generated-expression update, plus an adapter  |
| Cross-area features (inbox, MCP, filters)         | UNION over N pairs                                                             | Trivial                                             | Easy                                     | **Trivial**                                                                              |

Honest downsides of C2:

- The thread row gets one nullable column per subject type, and a new type changes the arc CHECK and
  the generated expression (`ALTER COLUMN … SET EXPRESSION`, PG ≥ 17, which rewrites a small table).
- Composite FKs need `UNIQUE (owner_id, id)` on four large tables. It is logically redundant with
  the PK, but costs an index each. Build them with `CREATE UNIQUE INDEX CONCURRENTLY`, which has a
  precedent in `2026-08-31T10-00-00.add-tenant-scoped-date-indexes.ts` with `noTransaction: true`.

---

## 5. Recommendation

**Adopt C2.**

- **Database:** shared `comment_threads` and `comments` tables, with an exclusive arc of typed
  composite FKs.
- **Server:** a shared `modules/comment-threads` core, with a small subject adapter per entity.
- **Client:** shared thread components in `components/common/threads/`, with thin per-surface
  containers.

Why:

1. **Integrity comes from the database, not from discipline.** Real FKs, native cascades and
   tenant-consistent composite FKs are what #4576 already relies on. The merge and clean-up hazards
   in §3.2 are then handled by a few explicit UPDATEs at known call sites, not by triggers.
2. **One lifecycle.** The dynamic report needed several review rounds to get the ordering,
   resolve-stamp and soft-delete semantics right. Copying them four times (A) multiplies that cost
   and the drift.
3. **Cross-entity views come for free,** because anchors are relational. Examples: a charge showing
   its documents' and transactions' threads, a charges filter on open threads, and an MCP tool.
4. **Cheap enough to extend.** A sixth entity (a business, a misc expense, a salary record) is one
   migration and a ~60-line adapter.

**Existing dynamic-report threads: adapt now, migrate their storage with #4579** (details in §7).

- Their anchor is a soft reference into JSON, and #4579 already plans to re-key them from
  `template_name` to a `template_id` uuid.
- Moving them now would mean two data migrations and a name-keyed arc column that is thrown away
  later.
- Moving them together with #4579 means one migration onto a clean uuid FK.
- Meanwhile, the dynamic report shares the server helpers and the client components, so it already
  behaves identically.

---

## 6. Proposed design

### 6.1 Schema (SQL sketch)

**Migration 1** (`noTransaction: true`): tenant-composite unique keys on the subject tables.

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS charges_owner_id_id_uindex
  ON accounter_schema.charges (owner_id, id);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS documents_owner_id_id_uindex
  ON accounter_schema.documents (owner_id, id);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS transactions_owner_id_id_uindex
  ON accounter_schema.transactions (owner_id, id);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS business_trips_owner_id_id_uindex
  ON accounter_schema.business_trips (owner_id, id);
```

A non-partial unique index is enough for an FK target. Optionally promote each one with
`ADD CONSTRAINT … UNIQUE USING INDEX` in migration 2 so the intent shows up in the catalog.

**Migration 2:** the shared tables.

```sql
CREATE TABLE IF NOT EXISTS accounter_schema.comment_threads
(
    id               uuid        DEFAULT uuidv7()          NOT NULL
        CONSTRAINT comment_threads_pk PRIMARY KEY,
    owner_id         uuid                                  NOT NULL,
    subject_type     text                                  NOT NULL,
    charge_id        uuid,
    document_id      uuid,
    transaction_id   uuid,
    business_trip_id uuid,
    -- one static, indexable subject key for reads (pgtyped needs static SQL)
    subject_id       uuid GENERATED ALWAYS AS
        (COALESCE(charge_id, document_id, transaction_id, business_trip_id)) STORED,
    created_by       uuid                                  NOT NULL,  -- acting user; no FK, like created_by elsewhere
    created_at       timestamptz DEFAULT clock_timestamp() NOT NULL,
    resolved_at      timestamptz,
    resolved_by      uuid,
    CONSTRAINT comment_threads_subject_arc CHECK (
        num_nonnulls(charge_id, document_id, transaction_id, business_trip_id) = 1
        AND CASE subject_type
              WHEN 'charge'        THEN charge_id        IS NOT NULL
              WHEN 'document'      THEN document_id      IS NOT NULL
              WHEN 'transaction'   THEN transaction_id   IS NOT NULL
              WHEN 'business_trip' THEN business_trip_id IS NOT NULL
              ELSE false
            END),
    CONSTRAINT comment_threads_resolved_pair CHECK ((resolved_at IS NULL) = (resolved_by IS NULL)),
    CONSTRAINT comment_threads_owner_id_unique UNIQUE (owner_id, id),
    CONSTRAINT comment_threads_charge_fk FOREIGN KEY (owner_id, charge_id)
        REFERENCES accounter_schema.charges (owner_id, id) ON DELETE CASCADE,
    CONSTRAINT comment_threads_document_fk FOREIGN KEY (owner_id, document_id)
        REFERENCES accounter_schema.documents (owner_id, id) ON DELETE CASCADE,
    CONSTRAINT comment_threads_transaction_fk FOREIGN KEY (owner_id, transaction_id)
        REFERENCES accounter_schema.transactions (owner_id, id) ON DELETE CASCADE,
    CONSTRAINT comment_threads_business_trip_fk FOREIGN KEY (owner_id, business_trip_id)
        REFERENCES accounter_schema.business_trips (owner_id, id) ON DELETE CASCADE
);

-- reads: "threads of these subjects", ordered
CREATE INDEX IF NOT EXISTS comment_threads_subject_index
    ON accounter_schema.comment_threads (owner_id, subject_type, subject_id, created_at, id);
-- FK cascades and merge re-pointing look threads up by the referencing columns
CREATE INDEX IF NOT EXISTS comment_threads_charge_index
    ON accounter_schema.comment_threads (owner_id, charge_id) WHERE charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comment_threads_document_index
    ON accounter_schema.comment_threads (owner_id, document_id) WHERE document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comment_threads_transaction_index
    ON accounter_schema.comment_threads (owner_id, transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comment_threads_business_trip_index
    ON accounter_schema.comment_threads (owner_id, business_trip_id) WHERE business_trip_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS accounter_schema.comments
(
    id         uuid        DEFAULT uuidv7()          NOT NULL
        CONSTRAINT comments_pk PRIMARY KEY,
    owner_id   uuid                                  NOT NULL,
    thread_id  uuid                                  NOT NULL,
    author_id  uuid                                  NOT NULL,
    content    text                                  NOT NULL
        CONSTRAINT comments_content_length
            CHECK (char_length(content) BETWEEN 1 AND 10000 AND content ~ '[^[:space:]]'),
    created_at timestamptz DEFAULT clock_timestamp() NOT NULL,
    edited_at  timestamptz,
    deleted_at timestamptz,
    -- backs future per-type extension tables (e.g. dynamic-report view context, §7)
    CONSTRAINT comments_owner_id_unique UNIQUE (owner_id, id),
    CONSTRAINT comments_thread_fk FOREIGN KEY (owner_id, thread_id)
        REFERENCES accounter_schema.comment_threads (owner_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS comments_thread_index
    ON accounter_schema.comments (thread_id, created_at, id);
```

**Migration 3:** RLS for both tables. Copy `2026-09-28T10-30-00.rls-dynamic-report-comments.ts`
verbatim with the table list changed: ENABLE, FORCE, `tenant_isolation`, `tenant_isolation_delete`,
`tenant_isolation_update`.

Notes:

- **Many threads per subject:** there is no UNIQUE constraint on the subject.
  - "Notes, open questions, discussions" are naturally distinct items, each resolvable on its own.
  - A charge merge then only re-points rows, with no message merging.
  - If product wants one thread per entity, add a partial unique index on
    `(owner_id, subject_type, subject_id)` (Q1).
- **Timestamps:** `clock_timestamp()` everywhere, and `(created_at, id)` as the order.
- **Owner changes:** the composite FKs use the default `ON UPDATE NO ACTION`, so a subject's
  `owner_id` can't be changed out from under its threads. No flow changes a subject's owner today.
- **Registration and catalog tests:**
  - Register all three files at the end of `MIGRATIONS` in
    `packages/migrations/src/run-pg-migrations.ts`, with timestamps after `2026-09-28T10-30-00`.
  - `rls-all-tables.test.ts` and `uuidv7-id-defaults.test.ts` pick the new tables up automatically.

### 6.2 GraphQL surface

**Top-level operations, not fields on the entity types.** Two reasons:

1. **The lesson from the dynamic report.** A thread mutation must refetch only thread data. The
   charges table's `AllCharges` query and each row's `RefetchChargeForChargesTable` are expensive,
   and there is no urql cache (`providers/urql.tsx`), so every refetch is explicit.
2. **`Charge` is an interface** with ~12 implementing types. Every field needs
   `extend interface Charge` plus `extend type X` for each implementation (see
   `accountant-approval.graphql.ts`). That is a lot of surface for data we don't want nested anyway.

```graphql
enum CommentSubjectType {
  CHARGE
  DOCUMENT
  TRANSACTION
  BUSINESS_TRIP
}

input CommentSubjectInput {
  type: CommentSubjectType!
  id: UUID!
}

" a discussion attached to one record "
type CommentThread {
  id: UUID!
  subjectType: CommentSubjectType!
  subjectId: UUID!
  " short human label from the subject adapter, e.g. 'Invoice 1042 · 12 Mar 2026' "
  subjectLabel: String!
  createdAt: DateTime!
  " display name; null for a former member "
  createdBy: String
  resolvedAt: DateTime
  resolvedBy: String
  " live (not deleted) messages "
  messageCount: Int!
  lastMessageAt: DateTime
  " oldest first (created_at, id) "
  messages: [Comment!]!
}

type Comment {
  id: UUID!
  threadId: UUID!
  " null once deleted "
  content: String
  createdAt: DateTime!
  editedAt: DateTime
  deletedAt: DateTime
  author: String
  isMine: Boolean!
}

" per-subject counts, for table indicators and delete confirmations "
type CommentThreadSummary {
  subjectType: CommentSubjectType!
  subjectId: UUID!
  openCount: Int!
  resolvedCount: Int!
  " open threads on related records (a charge's documents and transactions) "
  relatedOpenCount: Int!
  lastMessageAt: DateTime
}

extend type Query {
  " threads of one record; includeRelated adds a charge's documents' and transactions' threads "
  commentThreads(
    subject: CommentSubjectInput!
    includeRelated: Boolean! = false
  ): [CommentThread!]! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
  " summaries for up to 500 records of one type "
  commentThreadSummaries(
    type: CommentSubjectType!
    ids: [UUID!]!
    includeRelated: Boolean! = false
  ): [CommentThreadSummary!]!
    @requiresAuth
    @requiresAnyRole(roles: ["business_owner", "accountant"])
}

extend type Mutation {
  startCommentThread(subject: CommentSubjectInput!, content: String!): CommentThread!
    @requiresAuth
    @requiresAnyRole(roles: ["business_owner", "accountant"])
  " posts a reply; reopens a resolved thread "
  addComment(threadId: UUID!, content: String!): CommentThread!
    @requiresAuth
    @requiresAnyRole(roles: ["business_owner", "accountant"])
  editComment(id: UUID!, content: String!): Comment!
    @requiresAuth
    @requiresAnyRole(roles: ["business_owner", "accountant"])
  deleteComment(id: UUID!): Comment!
    @requiresAuth
    @requiresAnyRole(roles: ["business_owner", "accountant"])
  setCommentThreadResolved(threadId: UUID!, resolved: Boolean!): CommentThread!
    @requiresAuth
    @requiresAnyRole(roles: ["business_owner", "accountant"])
}
```

- **Errors** are thrown as coded `GraphQLError`s (`BAD_USER_INPUT`, `NOT_FOUND`, `FORBIDDEN`),
  exactly as in #4576. This deviates from the `CommonError` union convention in
  `.claude/rules/graphql-server.md` on purpose: `useApiMutation` and `errorSimplifier` already
  handle coded errors, and the two thread APIs should behave the same. Record this in the typeDefs
  header.
- **Codegen mappers** go in `codegen.ts`: `CommentThread` → `IGetThreadsBySubjectsResult` and
  `Comment` → `IGetCommentsByThreadIdsResult`, as #4576 did.
- **Schema checks.** The change is additive, so the Hive check (`graphql-schema-check.yml`) passes.
  Adding a value to `CommentSubjectType` later is flagged as "dangerous" but not breaking.

### 6.3 Server module layout

```
packages/server/src/modules/comment-threads/
  index.ts                         createModule({ id: 'comment-threads', typeDefs, resolvers, providers })
  types.ts                         re-exports from __generated__
  typeDefs/comment-threads.graphql.ts
  helpers/
    comment-content.helper.ts      MAX_COMMENT_LENGTH, zod commentContent, validateCommentContent,
                                   visibleCommentContent, isCommentByUser, invalidInput
                                   (moved out of reports/helpers/dynamic-report-comments.helper.ts)
    acting-user.helper.ts          requireActingUserId (FORBIDDEN for API keys), commentNotFound,
                                   displayName(injector, userId, businessId)
    subject-type.helper.ts         GraphQL enum <-> db text mapping
  providers/
    comment-threads.provider.ts    ALL pgtyped SQL (pgtyped only scans **/providers/*.provider.ts)
    comment-threads-authorization.provider.ts   extends AuthorizationProvider (docs/architecture/authorization-pattern.md)
  subjects/
    types.ts                       CommentSubjectAdapter interface
    charge.adapter.ts
    document.adapter.ts
    transaction.adapter.ts
    business-trip.adapter.ts
    index.ts                       SUBJECT_ADAPTERS registry (exhaustive, see below)
  resolvers/comment-threads.resolver.ts
  __tests__/…
```

Register `commentThreadsModule` in `packages/server/src/modules-app.ts`. Add it to the module list
in `packages/server/CLAUDE.md`, and add `CommentThreadsProvider` to
`src/__tests__/cache-isolation.integration.test.ts`.

**Subject adapter interface**

```ts
export type SubjectType = 'charge' | 'document' | 'transaction' | 'business_trip'

export type LoadedSubject<TRow> = { id: string; ownerId: string; row: TRow }

export interface CommentSubjectAdapter<TRow = unknown> {
  readonly type: SubjectType
  /** The comment_threads arc column that anchors this type. */
  readonly column: 'charge_id' | 'document_id' | 'transaction_id' | 'business_trip_id'
  /** RLS-scoped lookups through the entity's own provider loader; missing/invisible → absent. */
  loadMany(injector: Injector, ids: readonly string[]): Promise<Map<string, LoadedSubject<TRow>>>
  /** Short label for thread headers, lists and related-thread chips. */
  label(injector: Injector, subject: LoadedSubject<TRow>): Promise<string>
  /** Extra write rule beyond role + visibility. None today; the hook exists for future locks. */
  assertCanDiscuss?(injector: Injector, subject: LoadedSubject<TRow>): Promise<void>
  /** Types whose threads roll up into this one (charge → document, transaction). */
  readonly relatedTypes?: readonly SubjectType[]
}

export const SUBJECT_ADAPTERS = {
  charge: chargeAdapter,
  document: documentAdapter,
  transaction: transactionAdapter,
  business_trip: businessTripAdapter
} satisfies Record<SubjectType, CommentSubjectAdapter>
```

- **Loaders.** The adapters reuse `ChargesProvider.getChargeByIdLoader`,
  `DocumentsProvider.getDocumentsByIdLoader`, `TransactionsProvider.transactionByIdLoader` and
  `BusinessTripsProvider.getBusinessTripsByIdLoader`. The transaction loader is `T | Error`, so
  narrow it with `instanceof Error`.
- **Import direction.**
  - Adapters import entity providers. Entity modules import only `CommentThreadsProvider`, for
    merges.
  - `comment-threads.provider.ts` imports no entity provider, so the imports form no cycle.

**Provider (pgtyped queries, all static)**

| Method                                                          | SQL                                                                                                                                                                              | Notes                                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `getThreadsBySubjects({ ownerIds?, subjectType, subjectIds })`  | `WHERE subject_type = $t AND subject_id IN $$ids ORDER BY created_at, id`                                                                                                        | Uses `comment_threads_subject_index`                                           |
| `getRelatedThreadsByChargeIds({ chargeIds })`                   | UNION ALL: threads joined to `documents` on `document_id` where `d.charge_id IN …`, and to `transactions` on `transaction_id` where `x.charge_id IN …`; also returns `charge_id` | Uses the existing `documents_charge_id_index` / `transactions_charge_id_index` |
| `getSummaries(...)`                                             | GROUP BY over the two queries above, with `count(*) FILTER (WHERE resolved_at IS NULL)`                                                                                          | One query per page of 100 charges                                              |
| `getCommentsByThreadIdLoader`                                   | Same as #4576, bucketed in one pass                                                                                                                                              | DataLoader                                                                     |
| `startThread`                                                   | `db.transaction`: INSERT thread (arc column set via `CASE $subjectType WHEN 'charge' THEN $subjectId::uuid END`, …) then INSERT comment                                          |                                                                                |
| `addComment`                                                    | `db.transaction`: `UPDATE comment_threads SET resolved_at = NULL, resolved_by = NULL WHERE id AND owner_id RETURNING *`, then INSERT comment                                     | Posting reopens, as in #4576                                                   |
| `updateCommentContent` / `softDeleteComment`                    | Copied from #4576, including the author guard and `clock_timestamp()`                                                                                                            |                                                                                |
| `setThreadResolved`                                             | Copied from #4576 (keeps the first stamp)                                                                                                                                        |                                                                                |
| `reassignChargeThreads({ ownerId, fromChargeIds, toChargeId })` | `UPDATE comment_threads SET charge_id = $to WHERE owner_id = $o AND charge_id IN $$from`                                                                                         | Used by merge and clean-up (§6.4)                                              |
| `countThreadsBySubjects`                                        | Lean count, for delete confirmations                                                                                                                                             | Or reuse the summaries                                                         |

**Resolver flow for writes** (`startCommentThread`):

1. `authz.canWriteThreads()` checks the role.
2. `requireActingUserId` refuses API keys.
3. Validate the content with zod.
4. The adapter's `loadMany([id])` must find the subject; otherwise `NOT_FOUND`.
5. Run `assertCanDiscuss?`.
6. `provider.startThread({ ownerId: subject.ownerId, … })`.
7. Map `42501` (RLS) and `23503` (FK) to coded errors.
8. Wrap everything in `errorSimplifier`.

**Field resolvers:**

- `subjectLabel`: the adapter's `label`, resolved lazily so lists that don't ask for it stay cheap.
- `createdBy`, `resolvedBy` and `author`: `displayName`.
- `messageCount` and `lastMessageAt`: computed from the loaded messages.

### 6.4 Lifecycle integration in the charges module

- **`mergeChargesExecutor`.** Add
  `CommentThreadsProvider.reassignChargeThreads({ fromChargeIds: [id], toChargeId: baseChargeID })`
  to the per-charge `Promise.all`, next to `replaceDocumentsChargeId`, so it runs before
  `deleteCharges`.
  - This covers the resolver, cron and auto-matcher paths at once.
  - These flows run without a role, so the method is a plain tenant-scoped provider call. It
    performs no `requireRole` check, as the degrade rule notes.
- **`deleteCharges(chargeIds, injector, { threads })`.** Add a **required** option,
  `threads: 'delete' | { moveTo: string }`, so every current and future call site must decide.

| Call site                                                    | Disposition                                                                                                                             |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `charges.resolver.ts:543` explicit delete                    | `'delete'` (cascade; the dialog shows the count)                                                                                        |
| `merge-charges.helper.ts:69`                                 | `'delete'`, because threads were already moved to the base                                                                              |
| `documents.resolver.ts:374` unlink, old charge emptied       | `{ moveTo: newCharge.id }`                                                                                                              |
| `documents.resolver.ts:466` `deleteDocument`, charge emptied | `'delete'` (the user deleted the charge's only content; the dialog warns)                                                               |
| `transactions.resolver.ts:154` single unlink                 | `{ moveTo: newCharge.id }`                                                                                                              |
| `transactions.resolver.ts:285` batch unlink                  | `{ moveTo: newCharge.id }`. Pass the generated id into the `postUpdateActions` closure; today it is created after the closure is set up |
| `deel/resolvers/deel.resolvers.ts:159`                       | `'delete'` for now (these are generated charges; see Q3)                                                                                |

- **Rules file.** Add a "Comment threads (charge-deleting ops)" section to
  `.claude/rules/graphql-server.md` beside the accountant-approval section.
- **Document and transaction moves** need nothing: their threads follow the record.

### 6.5 Client layout

What moves out of `components/reports/dynamic-report/`, and what stays:

| Today (DR)                                                                                                                                                                                                                                                                      | Destination                                     | Change                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `thread-view.tsx` (`ThreadView`, `MessageItem`)                                                                                                                                                                                                                                 | `components/common/threads/thread-view.tsx`     | Generalise the props: `label`/`path` become `title` plus an optional `breadcrumb`; `detachedReason` becomes `notice?: ReactNode`; `view`/`ownerName` become `messageChip?: (m) => string \| null`; the "This period only" switch becomes an optional `messageFilter?: { label; predicate; hiddenLabel(n) }`. Keep the `data-*` hooks the tests use |
| `Composer` (inside `thread-view.tsx`)                                                                                                                                                                                                                                           | `common/threads/composer.tsx`                   | Unchanged UX: Cmd/Ctrl+Enter, a 10k counter, the double-send guard, focus hand-back                                                                                                                                                                                                                                                                |
| `discussions-list.tsx`                                                                                                                                                                                                                                                          | `common/threads/thread-list.tsx`                | Groups become generic `sections: { key; title; threads; note?(t) }[]`; `onSelect(threadId)`                                                                                                                                                                                                                                                        |
| Generic parts of `utils/comments.ts` (`MAX_COMMENT_LENGTH`, `isSendable`, base `CommentMessage`/`CommentThread` types, and `formatCommentDate` from `thread-view.tsx`)                                                                                                          | `common/threads/utils.ts`                       | DR types extend the base with `fromDate`/`toDate`/`scopeOwnerId`/`nodeId`                                                                                                                                                                                                                                                                          |
| The badge part of `comment-indicator.tsx`                                                                                                                                                                                                                                       | `common/threads/thread-count-badge.tsx`         | Speech bubble plus count, open or muted, and an "open inside" dot                                                                                                                                                                                                                                                                                  |
| `thread-view.stories.tsx`, `discussions-list.stories.tsx`                                                                                                                                                                                                                       | `common/threads/*.stories.tsx`                  |                                                                                                                                                                                                                                                                                                                                                    |
| `__tests__/thread-view.test.tsx`                                                                                                                                                                                                                                                | `common/threads/__tests__/thread-view.test.tsx` | Same assertions; **the test count must not drop**                                                                                                                                                                                                                                                                                                  |
| **Stays in DR:** `comment-indicator.tsx` (tree slot, now built on the badge), `thread-sheet.tsx`, `hooks/use-comments-layer.ts`, the tree parts of `utils/comments.ts` (`buildCommentStats`, `detachedThreads`, `revealVisibility`, `messagePeriodChip`), the DR mutation hooks |                                                 |                                                                                                                                                                                                                                                                                                                                                    |

New shared pieces:

- `common/threads/subject-threads-panel.tsx`: the presentational panel for one subject.
  - With no threads it shows an empty state with the composer ("Start a discussion").
  - Otherwise it shows a `ThreadList` (Open, then Resolved; related threads grouped under "On
    documents" and "On transactions", each with a `subjectLabel` chip) and a **New thread** button.
  - Selecting a thread shows `ThreadView`, whose existing `onShowAll` back button returns to the
    list.
- `common/threads/threads-sheet.tsx`: a `Sheet` container around the panel, for tables.
- `common/threads/use-subject-threads.ts`: the container hook.
  - Signature: `useSubjectThreads({ subject, includeRelated, onChanged })`.
  - It owns the `CommentThreads` query: paused without a subject, refetched `network-only` after
    each mutation.
  - It keeps in-memory drafts per subject and thread, and exposes
    `start / reply / edit / remove / setResolved` with `isSending` and `sendError`.
  - `onChanged` lets a table's summaries refresh.
- `common/threads/thread-summaries-provider.tsx`: holds the page's summaries.
  - `ThreadSummariesProvider({ type, ids, includeRelated })` runs one `commentThreadSummaries` query
    per page of ids, with `useThreadSummary(id)` and `refresh()`.
  - It follows the pattern of `charges/charges-extended-info-loader.tsx`.
- Mutation hooks in `src/hooks/`, all on `useApiMutation`:
  - `use-start-comment-thread.ts`, `use-add-comment.ts`, `use-edit-comment.ts`,
    `use-delete-comment.ts`, `use-set-comment-thread-resolved.ts`.
  - Posting and starting use `successToast: false` plus `toast.dismiss`.
  - Resolve and reopen raise toasts, as in DR.

Surfaces:

| Entity         | Where                                                                                                                                                                    | UI                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Charges        | `components/charges/columns.tsx`, `charges-table.tsx`, `charges-row.tsx`                                                                                                 | A narrow, hideable "Discussion" column with a `ThreadCountBadge` (own open count plus a related-open dot) from `ThreadSummariesProvider(CHARGE, pageIds, includeRelated: true)`; clicking opens `ThreadsSheet`. A thread mutation refreshes the **summaries only**, never `AllCharges` or the row's `RefetchChargeForChargesTable` |
| Charges        | `charge-extended-info.tsx` (new `AccordionItem value="discussion"`); `screens/charges/charge.tsx` inherits it                                                            | An inline `SubjectThreadsPanel` with `includeRelated`                                                                                                                                                                                                                                                                              |
| Charges        | `common/buttons/delete-charge-button.tsx`, `common/merge-charges/merge-charges-selection-form.tsx`                                                                       | "N discussion threads will be deleted" / "…will move to the base charge", from a lean summaries query                                                                                                                                                                                                                              |
| Documents      | `documents-table/columns.tsx` + `document-actions-menu.tsx`; `screens/documents/all-documents/index.tsx`; later `documents-gallery.tsx`                                  | A row badge that opens the sheet; the delete-document dialog (`common/buttons/delete-document-button.tsx`) shows the count                                                                                                                                                                                                         |
| Transactions   | `transactions-table/columns.tsx` (Actions column), used by `charge-transactions-table.tsx`, `business/transactions-section.tsx` and balance-report extended transactions | A row badge that opens the sheet                                                                                                                                                                                                                                                                                                   |
| Business trips | `business-trips/business-trip.tsx` / `common/business-trip-report/parts/report-header.tsx`; `business-trips-row.tsx`                                                     | A "Discussion" button in the header and a badge in the list                                                                                                                                                                                                                                                                        |

---

## 7. The existing dynamic-report threads

| Option                                          | For                                                                                                            | Against                                                                                                                                                                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep** permanently                            | No risk to freshly shipped, well-tested code                                                                   | Two storage implementations of one lifecycle; inbox, MCP and filters need a UNION forever                                                                                                                                                      |
| **Migrate now**                                 | One implementation immediately                                                                                 | Two data migrations: to a name-keyed arc (`template_name text` with `ON UPDATE CASCADE`) now, then to `template_id` with #4579; soft-reference anchor, `node_kind` and `node_label` columns on the shared row; churn in code reviewed days ago |
| **Adapt now, migrate with #4579** (recommended) | Shared helpers and UI now, so behaviour is identical; one data migration onto a clean uuid FK once #4579 lands | The dynamic report keeps its own tables until then                                                                                                                                                                                             |

**Adapt now** (PRs P4 and P5):

- Server: `dynamic-report-comments.helper.ts` and `.resolver.ts` import the content validator,
  `requireActingUserId`, `displayName`, `visibleCommentContent` and `isCommentByUser` from
  `comment-threads/helpers`. No schema or behaviour change.
- Client: DR renders the shared `ThreadView`, `Composer`, `ThreadList` and `ThreadCountBadge`.

**Migrate with #4579** (P13). The trigger is #4579 landing, or a cross-area feature such as an
inbox, notifications or an MCP tool that covers the dynamic report, whichever comes first.

1. Additive DDL on `comment_threads`:
   - `dynamic_report_template_id uuid`, `dynamic_report_node_id text` (CHECK 1–200) and
     `dynamic_report_node_kind text` (CHECK `leaf|branch`);
   - `subject_label text` (the last-known label, used only by soft-reference subjects);
   - composite FK `(owner_id, dynamic_report_template_id) → dynamic_report_templates (owner_id, id)`
     `ON DELETE CASCADE`;
   - arc CHECK and `subject_id` expression extended to include the template id;
   - a partial unique index `(owner_id, dynamic_report_template_id, dynamic_report_node_id)`
     `WHERE subject_type = 'dynamic_report_node'`, which keeps one thread per node.
2. A per-message extension table:
   - `dynamic_report_comment_views (comment_id uuid PK, owner_id, from_date, to_date, scope_owner_id)`;
   - `FK (owner_id, comment_id) → comments (owner_id, id) ON DELETE CASCADE`, which is why
     `comments_owner_id_unique` exists from day one;
   - RLS as elsewhere.
3. Data copy, keeping ids so uuidv7 ordering holds:

```sql
INSERT INTO accounter_schema.comment_threads
  (id, owner_id, subject_type, dynamic_report_template_id, dynamic_report_node_id,
   dynamic_report_node_kind, subject_label, created_by, created_at, resolved_at, resolved_by)
SELECT t.id, t.owner_id, 'dynamic_report_node', tpl.id, t.node_id, t.node_kind, t.node_label,
       (SELECT c.author_id FROM accounter_schema.dynamic_report_comments c
         WHERE c.thread_id = t.id ORDER BY c.created_at, c.id LIMIT 1),  -- every DR thread has ≥1 message
       t.created_at, t.resolved_at, t.resolved_by
FROM accounter_schema.dynamic_report_threads t
JOIN accounter_schema.dynamic_report_templates tpl
  ON tpl.owner_id = t.owner_id AND tpl.name = t.template_name;

INSERT INTO accounter_schema.comments
  (id, owner_id, thread_id, author_id, content, created_at, edited_at, deleted_at)
SELECT id, owner_id, thread_id, author_id, content, created_at, edited_at, deleted_at
FROM accounter_schema.dynamic_report_comments;

INSERT INTO accounter_schema.dynamic_report_comment_views
  (comment_id, owner_id, from_date, to_date, scope_owner_id)
SELECT id, owner_id, from_date, to_date, scope_owner_id
FROM accounter_schema.dynamic_report_comments;
```

4. Point `DynamicReportCommentsProvider` at the shared tables, and **keep the DR GraphQL API
   unchanged as a facade**:
   - `dynamicReportThreads` and friends stay, with the same types;
   - the client doesn't change;
   - the 1.1k-line integration test is the regression suite;
   - the Hive check sees no diff.
5. Drop the old tables in a later forward-only migration, after one release.

---

## 8. Phased PR plan

Each PR is small, squash-merged and carries a changeset (`require-changeset.yml`). Order and
dependencies:

```
P0 → P5 → P6 ─┬→ P7 → P8 → P9 → P10 → P11
P1 → P2 → P3 ─┘                   P12 (after P2), P4 (after P2), P13 (with #4579)
```

| PR                                | Scope                                                                                                                                                                                                | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Acceptance                                                                                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** client: fix #4580          | `components/ui/alert-dialog.tsx` overlay and content go from `z-50` to `z-1002`, above `Dialog`/`Sheet` at `z-1001`; drop the `className="z-1002"` override in DR `thread-view.tsx`                  | Stories; manual check with the template-delete dialog and the message-delete dialog in the sheet                                                                                                                                                                                                                                                                                                                                                                                                      | Both confirmations are visible and clickable, overlay included                                                                                                                                        |
| **P1** migrations                 | The 3 files in §6.1 (the unique indexes with `noTransaction: true`, the tables, RLS), registered in `run-pg-migrations.ts`                                                                           | `rls-all-tables.test.ts`, `uuidv7-id-defaults.test.ts`; new `packages/migrations/src/__tests__/comment-threads.test.ts`: arc CHECK (zero or two columns rejected, type mismatch rejected), a tenant-mismatched composite FK rejected, cascade on subject delete, the content CHECK                                                                                                                                                                                                                    | `yarn local:setup` is clean; `migration-conflict-check` and `verify-migrations.ts` pass                                                                                                               |
| **P2** server core                | `modules/comment-threads` (typeDefs, provider, authz provider, helpers, 4 adapters, resolvers), `codegen.ts` mappers, `modules-app.ts`, the cache-isolation list, the server `CLAUDE.md` module list | Unit: helpers, adapters (mocked injector), resolver (API key → `FORBIDDEN`, null `content` when deleted, `isMine`). Integration (harness from `dynamic-report-comments.integration.test.ts`, `RLS_TEST_ROLE`): lifecycle, ordering, reopen on post, resolve keeps its stamp, author-only edit and delete, soft delete, related rollup (a moved document's thread follows it), cross-tenant read and write denied, multi-business read-scope-but-not-write-target → `FORBIDDEN`, summaries for 100 ids | The API works end to end in GraphiQL; `yarn generate`, lint and typecheck pass                                                                                                                        |
| **P3** charge lifecycle           | `reassignChargeThreads` in `mergeChargesExecutor`; the required `threads` option on `deleteCharges` at the 7 call sites (§6.4); the rules-file note                                                  | Integration: a merge moves threads (resolver path and `executeReferenceMergePlan`); unlinking the last document or transaction moves threads to the new charge; explicit delete cascades; `deleteDocument` cascades the document's threads                                                                                                                                                                                                                                                            | No path deletes a discussion except an explicit, confirmed delete                                                                                                                                     |
| **P4** DR server adapt            | `reports/helpers                                                                                                                                                                                     | resolvers/dynamic-report-comments.*` import the shared helpers; behaviour-preserving                                                                                                                                                                                                                                                                                                                                                                                                                  | Existing DR unit and integration tests unchanged and green                                                                                                                                            | No schema diff; the test count is unchanged |
| **P5** client extract             | Move and generalise `ThreadView`, `Composer`, `ThreadList`, `ThreadCountBadge` and `utils` into `components/common/threads/`; DR uses them                                                           | Existing DR tests pass; moved `thread-view.test.tsx` keeps its assertions; the test count doesn't drop; `tsc --noEmit`                                                                                                                                                                                                                                                                                                                                                                                | DR looks and behaves identically (manual steps 1–5 of the #4575 verification list)                                                                                                                    |
| **P6** client toolkit             | Generic mutation hooks, `useSubjectThreads`, `SubjectThreadsPanel`, `ThreadsSheet`, `ThreadSummariesProvider`, stories                                                                               | `subject-threads-panel.test.tsx` (`createRoot` + `act`); a hook test with a custom urql exchange (pattern in `dynamic-report/__tests__/layer-hooks.test.tsx`): a mutation refetches only `CommentThreads` and summaries `network-only`                                                                                                                                                                                                                                                                | Storybook shows empty, one-thread, many-threads, related-group, error and loading states                                                                                                              |
| **P7** charges UI                 | Discussion column, extended-info accordion, charge screen, delete and merge dialog copy                                                                                                              | A table test in the style of `charges/__tests__/charges-table-refetch.test.tsx`: posting doesn't refetch `AllCharges` or the row query; the badge updates from summaries                                                                                                                                                                                                                                                                                                                              | Manual: comment on a charge, on its document and on its transaction; the charge shows own and related counts; merge moves threads; unlinking the last document keeps the discussion on the new charge |
| **P8** documents UI               | Badge and sheet in `documents-table`; all-documents screen; delete-document count                                                                                                                    | Component test for the badge and sheet wiring                                                                                                                                                                                                                                                                                                                                                                                                                                                         | A document's thread follows it when re-matched                                                                                                                                                        |
| **P9** transactions UI            | Badge and sheet in `transactions-table`                                                                                                                                                              | Same                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Same                                                                                                                                                                                                  |
| **P10** business trips UI         | Header button and list badge                                                                                                                                                                         | Same                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Same                                                                                                                                                                                                  |
| **P11** charges filter (optional) | `ChargeFilter.hasOpenThreads` (server, `filtered-charges.helper.ts`) plus a chip in `charges-filters`; optionally an approve-with-open-threads nudge (Q4)                                            | Server filter test; client filter-schema test                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Accountants can list the charges with open questions                                                                                                                                                  |
| **P12** MCP (optional)            | Read-only `accounter_get_comment_threads` in `packages/mcp-server/src/tools/`, added to the allowlist and policy                                                                                     | Tool tests following `tools/__tests__` (allowlist, mirroring contract, byte budget)                                                                                                                                                                                                                                                                                                                                                                                                                   | Claude can answer "what's open on charge X"                                                                                                                                                           |
| **P13** DR storage migration      | §7, together with #4579                                                                                                                                                                              | The full DR integration suite on the facade; a data-migration test on seeded rows                                                                                                                                                                                                                                                                                                                                                                                                                     | Old tables are read-only for one release, then dropped                                                                                                                                                |

Rollout:

- There is no feature-flag system in the client. The API ships first and is additive, and each
  surface ships with its own PR (P7–P10).
- P3 **must** land before P7, so that no UI-created thread can be lost to a merge or clean-up.
- Announce each area to accountants when it ships.

---

## 9. Testing strategy

- **Server unit** (`yarn test`):
  - zod helpers: trim, empty, over 10k, whitespace-only;
  - subject-type mapping;
  - adapters: loader narrowing, labels;
  - resolvers: `FORBIDDEN` for API keys, `NOT_FOUND` with one message for missing, deleted and
    not-yours, `isMine`, null content when deleted.
- **Server integration** (`yarn test:integration`, DB up and migrated):
  - reuse `__tests__/helpers/{db-connection,db-migrations,rls-role,test-db-config}.js`;
  - run the write-denial cases on the non-superuser `RLS_TEST_ROLE` pool, so the RLS policies
    actually apply;
  - cover every §6.4 call site;
  - check that summaries and related rollups stay correct after a document moves.
- **Migrations:**
  - the catalog tests pick up both new tables automatically;
  - a dedicated `comment-threads.test.ts` covers the arc, the composite FKs and the cascades;
  - in the §7 migration, a copy test compares row counts, ordering and view context.
- **Client** (`yarn generate` first, then `yarn test:client` and `tsc --noEmit`):
  - pure utils;
  - the moved `ThreadView` tests;
  - the panel and sheet;
  - the "no expensive refetch" tests.
  - There is no testing-library: render by hand with `createRoot` + `act`.
- **Stories:** shared components under `common/threads/`, with fake data and the `nullExchange`
  pattern from `business-trip-report/parts/*.stories.tsx`.
- **CI gotchas:**
  - **pgtyped scans only `**/providers/*.provider.ts`** (`docker/pgconfig.json`). Keep every `sql`
    query in `comment-threads.provider.ts`, never in adapters or helpers.
  - The CI pgtyped cache (`server-tests.yml`) is keyed on provider files, not on migrations. A
    migration that changes a column type read by an unchanged provider can hit a stale cache. Touch
    the provider, or regenerate locally and confirm.
  - `CREATE INDEX CONCURRENTLY` needs `noTransaction: true`, with one statement per `query()`.
  - `migration-conflict-check` fails on edits to existing migrations. Only add new files, with
    timestamps later than the latest.
  - `graphql-validation.yml` validates client operations against the schema. Run `yarn generate`,
    which is concurrent GraphQL and SQL codegen.
  - A green `yarn test:client` doesn't prove the package builds or that no tests were dropped.
    Compare test counts in P5.
  - Changesets are required on every PR.
  - The CI GraphQL codegen cache key must list each extension separately (`*.ts`, `*.tsx`).
    `hashFiles` has no brace expansion, so a `*.{ts,tsx}` pattern matches nothing, and a client-only
    PR that adds a document runs against stale generated types. Fixed in #4581.

---

## 10. Risks and open questions

**Decisions for the product owner or team lead:**

- **Q1: Threads per record.**
  - Recommended: many per record, each resolvable.
  - Alternative: one per record, like the dynamic report, via a partial unique index. It is simpler
    to use, but a merge then has to fuse two threads.
- **Q2: Roles.** Should `employee` users read threads, and should they write them? The
  recommendation is neither in v1, matching the dynamic report.
- **Q3: Deleting a charge that has threads.**
  - Recommended: cascade on explicit deletes, and move threads on the clean-up of emptied charges.
  - Alternatives:
    - FK `ON DELETE RESTRICT`: loud failures instead of silent loss, but it breaks flows until every
      path is handled;
    - skip clean-up when a charge has threads, which leaves empty charges behind.
  - The Deel clean-up path also needs a decision.
- **Q4: Open threads and accountant approval.**
  - Independent in v1.
  - Later: a warning when approving with open threads, or blocking it; a "has open threads" filter
    (P11).
- **Q5: Search.** Include thread text in the charge free-text search? Not planned. It would extend
  the search view added in `2026-02-16T19-00-00.enrich-extended-charges-with-text-search.ts`.
- **Q6: MCP.** A read tool (P12)? Write tools are out of scope.
- **Q7: When to migrate the dynamic report.** Do it with #4579 (recommended), or earlier if an inbox
  or notifications need a single source.
- **Q8: Retention.** Soft-deleted text stays in the DB, as in the dynamic report. Do we need a
  hard-purge path, for example for a privacy request?

**Risks:**

- **Index builds on large tables.** P1 builds unique indexes on `transactions` and `documents`.
  `CONCURRENTLY` avoids write locks, but a failed concurrent build leaves an INVALID index that must
  be dropped. Schedule it off-peak.
- **Merges aren't transactional** (existing behaviour). A merge that fails halfway can leave threads
  re-pointed while the old charge still exists. This is the same risk class as documents and
  transactions today; making merges transactional is a separate change.
- **Multi-business scope.** Users may see subjects they can't write threads on. The composer must
  show a clear "switch business" message on `FORBIDDEN`.
- **Layering.**
  - A sheet opened from rows inside dialogs (similar-charges modal, charge-matches): verify the
    stacking, since `Sheet` and `Dialog` share `z-1001` and a later portal wins.
  - The delete confirmation inside the sheet depends on P0.
- **Adapter labels** (`subjectLabel`) must not trigger N+1 lookups in lists. Resolve them lazily
  through the loaders, and only when a list asks for them.
- **Adding a subject type later** rewrites `comment_threads` (arc CHECK and generated expression).
  This is cheap while the table is small, so batch new types where possible.

---

## 11. References

**PRs and issues**

- #4575: spec, `docs/dynamic-report-comments/spec.md` (branch `claude/vibrant-maxwell-chcwl2`).
- #4576: server, branch `claude/vibrant-maxwell-chcwl2-comments-server`. This branch is
  authoritative for the server and migration files, including fix `414c6476`.
- #4577: client layer seam, branch `claude/vibrant-maxwell-chcwl2-layer-seam`.
- #4578: client UI, branch `claude/vibrant-maxwell-chcwl2-comments-client`.
- #4579: dynamic report stable template ids and report scopes. P13 depends on it.
- #4580: `AlertDialog` z-index. Fixed in P0.
- #4581: CI codegen cache key hashing client files (see §9).

**Existing files to reuse or change**

- Migrations:
  - `packages/migrations/src/actions/2026-09-28T10-00-00.dynamic-report-comments.ts`
  - `packages/migrations/src/actions/2026-09-28T10-30-00.rls-dynamic-report-comments.ts`
  - `packages/migrations/src/actions/2026-08-31T10-00-00.add-tenant-scoped-date-indexes.ts`
    (`noTransaction` precedent)
  - `packages/migrations/src/run-pg-migrations.ts`
  - `packages/migrations/src/__tests__/{rls-all-tables,uuidv7-id-defaults}.test.ts`
- Server, dynamic-report comments:
  - `packages/server/src/modules/reports/{typeDefs,helpers,providers,resolvers}/dynamic-report-comments.*`
- Server, auth:
  - `packages/server/src/modules/auth/helpers/acting-user.helper.ts` (`getActingUserId`)
  - `packages/server/src/modules/auth/providers/business-users.provider.ts`
    (`getUserDisplayNamesLoader`)
  - `packages/server/src/modules/auth/providers/authorization.provider.ts`
  - `packages/server/src/modules/charges/providers/charges-authorization.provider.ts`
  - `docs/architecture/authorization-pattern.md`
- Server, charge lifecycle:
  - `packages/server/src/modules/charges/helpers/merge-charges.helper.ts`
  - `packages/server/src/modules/charges/helpers/delete-charges.helper.ts`
  - `packages/server/src/modules/documents/resolvers/documents.resolver.ts`
  - `packages/server/src/modules/transactions/resolvers/transactions.resolver.ts`
  - `packages/server/src/modules/deel/resolvers/deel.resolvers.ts`
  - `packages/server/src/modules/cron-jobs/helpers/run-cron-jobs.helper.ts`
  - `packages/server/src/modules/charges-matcher/providers/charges-matcher.provider.ts`
- Server, related modules and wiring:
  - `packages/server/src/modules/accountant-approval/` (`degradeChargesAccountantApproval`, and the
    `extend interface Charge` pattern)
  - `packages/server/src/modules/common/providers/audit-logs.provider.ts`
  - `packages/server/src/shared/errors.ts` (`errorSimplifier`)
  - `packages/server/src/modules-app.ts`
  - `codegen.ts`
  - `docker/pgconfig.json`
  - `.github/workflows/server-tests.yml`
  - `docs/architecture/provider-cache-patterns.md`
- Client, dynamic report:
  - `packages/client/src/components/reports/dynamic-report/{thread-view,discussions-list,thread-sheet,comment-indicator}.tsx`
  - `packages/client/src/components/reports/dynamic-report/utils/comments.ts`
  - `packages/client/src/components/reports/dynamic-report/hooks/use-comments-layer.ts`
  - `packages/client/src/components/reports/dynamic-report/dialogs/delete-template-confirmation.tsx`
- Client, hooks and providers:
  - `packages/client/src/hooks/use-api-mutation.ts`
  - `packages/client/src/hooks/use-{add,edit,delete}-dynamic-report-comment.ts`
  - `packages/client/src/hooks/use-set-dynamic-report-thread-resolved.ts`
  - `packages/client/src/providers/urql.tsx` (no cache exchange)
- Client, target surfaces:
  - `packages/client/src/components/charges/{columns.tsx,charges-row.tsx,charges-table.tsx,charge-extended-info.tsx,charges-extended-info-loader.tsx}`
  - `packages/client/src/components/documents-table/{columns.tsx,document-actions-menu.tsx,documents-gallery.tsx}`
  - `packages/client/src/components/transactions-table/columns.tsx`
  - `packages/client/src/components/business-trips/{business-trip.tsx,business-trips-row.tsx}`
  - `packages/client/src/components/common/buttons/{delete-charge-button,delete-document-button}.tsx`
  - `packages/client/src/components/common/merge-charges/merge-charges-selection-form.tsx`
  - `packages/client/src/components/ui/alert-dialog.tsx`
- MCP:
  - `packages/mcp-server/src/tools/`
  - `packages/mcp-server/src/tools/allowlist.ts`

**Critical files for implementation**

- `packages/migrations/src/actions/2026-09-28T10-00-00.dynamic-report-comments.ts` (the pattern for
  the new DDL)
- `packages/server/src/modules/reports/providers/dynamic-report-comments.provider.ts` (the lifecycle
  SQL to generalise)
- `packages/server/src/modules/charges/helpers/delete-charges.helper.ts` and
  `merge-charges.helper.ts` (thread disposition)
- `packages/client/src/components/reports/dynamic-report/thread-view.tsx` (to extract into
  `components/common/threads/`)
- `packages/client/src/components/charges/charge-extended-info.tsx` (the first new surface)
