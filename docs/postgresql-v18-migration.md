# Postgres 16 → 18 upgrade: code review, required adjustments, and follow-ups

## Context

Production Postgres is moving from v16 to v18. This plan answers three questions asked of the
codebase — what must change in code, what the upgrade unblocks, and what else matters — and then
scopes the work.

**Headline: the SQL in this repo needs no changes to run on 18.** I checked every PG17 and PG18
incompatibility from the upstream release notes against the schema and the server's queries. The
codebase avoids essentially all of them, for structural reasons rather than luck:

| PG17/18 incompatibility                                                                                                          | Status here                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PG18: `GENERATED ALWAYS AS (…)` defaults to VIRTUAL instead of STORED                                                            | No generated columns exist, in server SQL or in any of the 205 migrations                                                                                                                                  |
| PG17: restricted `search_path` for `VACUUM`/`ANALYZE`/`REINDEX`/`CREATE INDEX`/matviews                                          | No materialized views; the only expression indexes use `COALESCE` (built-in). RLS helpers already declare `SET search_path = pg_catalog` (`2026-02-10T12-05-00.create-rls-helper-function.ts:12,36,52`)    |
| PG18: `AFTER` triggers run as the role active when queued                                                                        | 20 `AFTER` triggers, but none are `CONSTRAINT`/`DEFERRABLE`, so they fire at statement end under one unchanging role                                                                                       |
| PG18: `VACUUM`/`ANALYZE` now recurse into inheritance children                                                                   | No partitioned or inherited tables                                                                                                                                                                         |
| PG18: unlogged partitioned tables disallowed                                                                                     | No unlogged tables                                                                                                                                                                                         |
| PG18: `COPY FROM` CSV no longer treats `\.` as EOF                                                                               | No `COPY FROM`                                                                                                                                                                                             |
| PG17: `pg_stat_statements` renames, `pg_stat_bgwriter` → `pg_stat_checkpointer`; PG18: `pg_stat_wal`/`pg_stat_io` column changes | No monitoring catalog reads in app code — `observability/pool-monitor.ts` reads the in-process `pg.Pool` only                                                                                              |
| PG17: `old_snapshot_threshold`, `db_user_namespace`, `adminpack` removed                                                         | None referenced                                                                                                                                                                                            |
| PG18: MD5 password auth deprecated                                                                                               | No `md5()`/pgcrypto in SQL; hashing is `node:crypto`                                                                                                                                                       |
| Driver stack (`pg` 8.23.0, `slonik` 49.10.9, `pg-promise` 12.7.1, pgTyped 2.4.x)                                                 | node-postgres supports PG18; wire protocol stays 3.0, so PG18's 256-bit cancel keys (protocol 3.2 only) don't apply. The `@slonik/pg-driver` patch only relaxes a multi-statement guard — no protocol code |

## Status (2026-08-31)

Everything in Part 1 and four of Part 4's findings are **merged into `main`**. What remains is the
production upgrade itself (Part 2) and the opt-in follow-ups (Part 3).

| Item                                                  | PR                                                              | State                                                                                                                               |
| ----------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Part 1 — dev + CI pinned to Postgres 18               | [#4329](https://github.com/Urigo/accounter-fullstack/pull/4329) | ✅ merged                                                                                                                           |
| Part 4 — `getLedgerBalanceToDate` credit-entity-2 bug | [#4326](https://github.com/Urigo/accounter-fullstack/pull/4326) | ✅ merged                                                                                                                           |
| Part 4 — `$isUnmatched` correlation bug               | [#4327](https://github.com/Urigo/accounter-fullstack/pull/4327) | ✅ merged                                                                                                                           |
| Part 4 — non-sargable date predicates                 | [#4331](https://github.com/Urigo/accounter-fullstack/pull/4331) | ✅ merged                                                                                                                           |
| Part 4 — `financial_entities.name` trigram index      | [#4330](https://github.com/Urigo/accounter-fullstack/pull/4330) | ✅ merged                                                                                                                           |
| Part 2 — production upgrade runbook                   | —                                                               | ✅ runbook written ([`operations/postgres-18-upgrade.md`](operations/postgres-18-upgrade.md)); the upgrade itself not yet performed |
| Part 3 — 3.1 … 3.7 follow-ups                         | —                                                               | ⬜ not started                                                                                                                      |

**Two of those merges change Part 2's checklist,** so read the amendments rather than an older copy:

- #4330 added a **seventh** trigram index (`idx_financial_entities_name_trgm`), which must be in the
  post-upgrade `REINDEX` set — see Part 2 check 1.
- #4331 added **two new expression indexes** over `COALESCE(...)` date columns, both leading with
  `owner_id`. That strengthens the `ANALYZE` step (check 3) and makes the RLS
  `ScalarArrayOpExpr`-selectivity question in check 5 more consequential, not less.

Version skew is now resolved in the safe direction: dev and CI run 18 while production is still on
16, which is the harmless ordering. Do not let production overtake them.

---

**The stack is split across two vendors: the backend is deployed on Render, and the Postgres
database is Azure Database for PostgreSQL — Flexible Server.** (An earlier draft of this plan
treated the whole thing as Render, which got the database wrong. A later draft over-corrected and
dismissed the Render references as staging-only — also wrong: Render is the production _application_
host, and production migrations really do run in its build command against the Azure database,
confirmed 2026-08-31. Both vendors belong in this plan, for different layers. There is still no
`render.yaml` or infrastructure config in the repo, so neither layer is inferable from the code.)

Azure removes the usual cutover risks too, but for its own reasons: an in-place major version
upgrade "retains the server name and other settings of the current server" and requires no changes
to application connection strings, so no application config or code deploy is needed for the upgrade
itself. PG18 is GA on Flexible Server with in-place upgrade support in all regions.

So the actual work is small and splits three ways: two version pins plus a Docker-image layout break
(Part 1), a runbook for the things Azure's upgrade docs leave to us (Part 2), and a set of genuinely
useful follow-ups that only become available on 18 (Part 3).

---

## Part 1 — Required code changes ✅ merged in #4329

Scope: 3 files. Do this **before or with** the production upgrade, never after — CI codegen and
tests validate queries against the pinned dev image, so leaving it on 16 means PRs are checked
against a planner and parser that production no longer runs.

**Landed as [#4329](https://github.com/Urigo/accounter-fullstack/pull/4329).** Verified on 18.6
before merge: all migrations applied cleanly, `yarn test` / `yarn test:integration` /
`yarn test:demo-seed` / `rls-all-tables` all green, and pgTyped output byte-identical to the same
codegen run against 16.10 (zero type drift). The subsections below are kept as the record of what
changed and why — in particular the `PGDATA` symlink trap, which is the thing to remember at the
next major bump.

> **Developer action, if you haven't already:** `rm -rf docker/.accounter-dev/postgresql/db` then
> `yarn local:setup`. An 18 server will not start against a 16 data directory.

### 1.1 `docker/docker-compose.dev.yml` — bump the image _and_ fix the data-dir mount

This is the one change with a real trap. The official `postgres:18` images moved `PGDATA` to a
version-scoped path (`/var/lib/postgresql/18/docker`) and moved the declared `VOLUME` to
`/var/lib/postgresql`. `/var/lib/postgresql/data` is now a **symlink**, so the current config —
which both sets `PGDATA` to that path and bind-mounts over it — makes the container fail at startup.
A tag-only bump breaks every CI workflow that uses `.github/actions/setup` with `localDB`/`pgTyped`,
because that action brings this exact compose file up (`action.yml:68-75`) and then runs
`yarn db:init` and pgTyped against it.

```yaml
db:
  image: postgres:18-alpine # was postgres:16-alpine
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: accounter
    # postgres:18+ scopes PGDATA by major version (/var/lib/postgresql/18/docker) and
    # declares its VOLUME at /var/lib/postgresql. Leave PGDATA unset and mount the
    # parent: /var/lib/postgresql/data is a symlink in these images, so mounting
    # over it fails at startup.
  volumes:
    - ./.accounter-dev/postgresql/db:/var/lib/postgresql
```

Drop the `PGDATA` line entirely. The healthcheck (`pg_isready -d $$POSTGRES_DB -U $$POSTGRES_USER`)
is unaffected.

**Dev-machine step:** the cluster now lands in `./.accounter-dev/postgresql/db/18/docker`, and an 18
server refuses to start against a 16 data directory regardless. Each developer deletes
`./.accounter-dev/postgresql/db` and re-runs `yarn local:setup`. Dev-only data; nothing to preserve.
CI is unaffected — the path is fresh every run.

### 1.2 `.github/workflows/server-tests.yml:17` — bump the service container

`image: postgres:16-alpine` → `postgres:18-alpine`. Service containers mount no volume, so the tag
bump alone is sufficient here.

### 1.3 `README.md` — refresh the local-DB instructions

Add the "delete `./.accounter-dev/postgresql/db` when the major version changes" note near the
`yarn local:setup` step (step 4). While in there, fix the service name in the prerequisites block at
`README.md:142`: it says `docker compose -f docker/docker-compose.dev.yml up -d postgres`, but the
service is named `db` (`docker-compose.dev.yml:4`), so that command has never worked.

---

## Part 2 — Upgrade runbook ✅ written

**The runbook now lives at
[`docs/operations/postgres-18-upgrade.md`](operations/postgres-18-upgrade.md) — use that, not this
section, on upgrade day.** Written in the style of the existing
`docs/operations/db-connection-pool.md` (problem → diagnosis → steps), it is the operational
document: failure modes, pre-flight, rehearsal, the six post-upgrade checks, a symptom → first-check
table, the rollback reality, and a sign-off checklist.

The rest of this section is the reasoning it was distilled from, kept for review. It exists because
Azure's upgrade docs cover the mechanics but say nothing about the parts that are ours: the trigram
reindex decision, statistics, and re-asserting the RLS invariants.

Three things the runbook has that this section did not, all found while writing it:

- The RLS re-assertion reuses the **four queries already verified against production**
  (`docs/coherent-owner-scoping-for-mcp/plan.md:51-108`) together with their expected values, rather
  than the three generic catalog queries sketched below. Step 3 (`relforcerowsecurity`) is the one
  that fails quietly with every other check green — worth knowing that was learned by running them.
- The trigram `REINDEX` must be `CONCURRENTLY` for **all seven**: only
  `idx_financial_entities_name_trgm` was originally built that way, so a plain `REINDEX` would take
  `ACCESS EXCLUSIVE` on `charges`, `transactions` and `documents`.
- A post-reindex `indisvalid`/`indisready` check, since a `CONCURRENTLY` rebuild that fails part-way
  leaves behind an index the planner silently ignores — the same trap #4330's migration guards
  against at build time.

**Step 0 — run Azure's Upgrade Validation Checks.** Do this first, and days early. Flexible Server
has a first-class pre-flight check (portal or `az postgres flexible-server upgrade-validate`) that
runs Azure's real compatibility rules against the actual server without touching it — no downtime,
no restart, no version change. It is authoritative in a way this document cannot be, because the
blocking rules vary by source/target pair and change over time. Requirements: server status
**Ready**, no other operation in progress, connectivity to every database on the server; it cannot
run against a read replica. Treat a clean validation run, not this checklist, as the go/no-go.

**Prerequisites (Azure-specific)**

- **≥10–20% free storage.** Azure calls this out explicitly: temporary log files and metadata
  operations grow disk usage mid-upgrade, and insufficient space causes upgrade failure or rollback.
  Check before booking the window; growing storage on Flexible Server is one-way.
- **Delete read replicas first.** In-place upgrade does not support geo-replication or read replicas
  — every replica, including cascading ones, must be deleted before upgrading the primary and
  re-created afterward. This is the one prerequisite that can't be done inside a short window.
- **Confirm the minor version you land on, don't choose it.** Azure automatically deploys the latest
  supported minor as part of the upgrade, so there is no 18.0 risk and nothing to negotiate — but
  record what you actually got. For context on why the minor matters: 18.1 fixed an OOM in parallel
  GIN index builds, 18.3 was an out-of-cycle release fixing regressions including a standby freeze,
  **18.5 was never released**, and 18.6 (2026-08-13) is current.
- **HA is dropped and re-added around the upgrade.** If HA is enabled, Azure disables it, upgrades
  the primary, then re-enables it — which needs spare capacity to provision a new standby. Verify
  the server's NSG rules permit traffic on ports **5432 and 6432** within the VNet and outbound to
  Azure Storage for log archiving; if they don't, HA silently fails to re-enable and you finish the
  window with no standby.
- **Enable upgrade logs before you start:** set `logfiles.download_enable = ON` and a sane
  `logfiles.retention_days`, then read `PG_Upgrade_Logs` during the run. This is the only real
  visibility into a stalled upgrade.
- **Check the connection username format.** If this server was ever automigrated from Single Server,
  the `username@servername` login format stops working after an in-place major upgrade — only plain
  `username` is accepted. Our connection string is assembled from `POSTGRES_USER`
  (`packages/server/scripts/set-db-url.cjs`, `environment.ts:319`), so this is a one-line env check
  across the server, migrations, MCP server and scrapers — but an easy way to take the app down
  post-upgrade if missed.
- **Freeze `prod` deploys for the window,** and first **confirm where production migrations actually
  run.** The claim that they run in the deploy build command is sourced to
  `packages/server/docs/demo-staging-guide.md:552-558`, which documents _staging on Render_ — it
  says nothing reliable about the Azure production deploy path, and nothing in the repo does. What
  is verifiable and still matters: the migration runner takes **no advisory lock**
  (`pg-migrator.ts`), so if migrations do run on deploy, a deploy landing mid-upgrade fails its
  build partway through. Resolve this before the window rather than assuming either way.

**No extension work needed for our schema.** Azure auto-upgrades most extensions during an in-place
upgrade, and `pg_trgm` — the only extension the schema creates
(`2026-03-23T12-00-00.index-search-strings.ts:7`) — is not on any of Azure's blocked lists. Checked
against Azure's blockers, the schema is also clean on: `EVENT TRIGGER`s (none — Azure's precheck
blocks them and requires dropping and recreating), views depending on `pg_stat_activity` (none; the
only two references are a comment in `server/src/index.ts:40` and a `pg_terminate_backend` call in
`rls-all-tables.test.ts:50`), objects depending on `pg_stat_statements` (none), large objects
(none), and PostGIS/TimescaleDB (not used).

**Rehearsal (this is the whole risk-reduction strategy)**

Azure's flow: **PITR-restore production to a new server**, upgrade that server, exercise it, record
the duration as the estimate for production, then delete it. Against the restored server, run the
checks below plus a real free-text search and one full scrape-ingestion batch.

Be precise about what rollback means here, because it is weaker than it looks:

- **Failure _during_ the upgrade** is well covered. Azure takes an implicit backup after a
  successful precheck and immediately before starting, and can use it to restore the instance to its
  previous version on error.
- **Regret _after_ a successful upgrade** is not. There is **no automated way to revert** — recovery
  is a PITR restore to a timestamp before the upgrade, which lands on a **new server** with a new
  name, and therefore is a connection-string change and a real cutover, not a rollback. Budget for
  this being the actual worst case, and confirm the backup retention window covers how long it might
  take someone to notice a regression.

**Post-upgrade checks — ours, not Azure's**

1. **Decide the trigram reindex.** PG18 changed full-text search and `pg_trgm` to use the cluster's
   default collation provider instead of always libc. Upstream: clusters defaulting to a _non-libc_
   provider "could observe changes in behavior of some full-text search functions, as well as the
   `pg_trgm` extension", and should reindex FTS and `pg_trgm` indexes after `pg_upgrade`. So check
   first:

   ```sql
   SELECT datname, datlocprovider, datcollate, datctype
   FROM pg_database WHERE datname = current_database();
   ```

   `datlocprovider = 'i'` (ICU) or `'b'` (builtin) → reindex is required. `'c'` (libc) → not
   required. Either way there are only seven indexes and this is cheap insurance:

   ```sql
   REINDEX INDEX CONCURRENTLY accounter_schema.idx_charges_desc_trgm;             -- charges.user_description
   REINDEX INDEX CONCURRENTLY accounter_schema.idx_trans_src_trgm;                -- transactions.source_description
   REINDEX INDEX CONCURRENTLY accounter_schema.idx_trans_src_ref_trgm;            -- transactions.source_reference
   REINDEX INDEX CONCURRENTLY accounter_schema.idx_docs_desc_trgm;                -- documents.description
   REINDEX INDEX CONCURRENTLY accounter_schema.idx_docs_remarks_trgm;             -- documents.remarks
   REINDEX INDEX CONCURRENTLY accounter_schema.idx_docs_serial_trgm;              -- documents.serial_number
   REINDEX INDEX CONCURRENTLY accounter_schema.idx_financial_entities_name_trgm;  -- financial_entities.name (added #4330)
   ```

   The seventh index is new: #4330 added `idx_financial_entities_name_trgm`
   (`2026-08-31T11-00-00.index-financial-entity-names.ts`) for the six counterparty-name `ILIKE`
   branches in the charges free-text filter. It was the one hot search column the original trigram
   work missed, and it is now equally exposed to the collation-provider change — do not work from a
   six-index copy of this list.

   This is load-bearing, not hygiene: the entire charges/transactions/documents free-text search is
   `ILIKE '%…%'` served by these GIN indexes, and `charges.provider.ts:213` states the strategy
   outright ("Identify IDs via Trigram indexes before doing any heavy math"). PG18 also adds
   parallel GIN builds (`enable_parallel_gin_build`, `max_parallel_maintenance_workers`), so the
   rebuild is faster than it would have been on 16. Use `CONCURRENTLY` for all seven regardless of
   how they were originally built: the first six were created with a plain
   `CREATE INDEX IF NOT EXISTS` (`2026-03-23T12-00-00.index-search-strings.ts`), only
   `idx_financial_entities_name_trgm` was built `CONCURRENTLY` (#4330). A plain `REINDEX` takes an
   `ACCESS EXCLUSIVE` lock and would block writes to `charges`, `transactions` and `documents` for
   the duration.

2. **Verify `pg_trgm`'s extension version** — `SELECT extname, extversion FROM pg_extension;`. Azure
   states it auto-upgrades most extensions during an in-place major upgrade, so unlike a bare
   `pg_upgrade` this should already be current. Run `ALTER EXTENSION pg_trgm UPDATE;` only if the
   version is behind what 18 ships; it is idempotent and harmless either way.

3. **`ANALYZE` the schema — Azure documents this as a required post-upgrade step,** not an
   optimization: run `ANALYZE` in each database to refresh `pg_statistic`, because missing or stale
   statistics cause bad plans and excess memory use. PG18's `pg_upgrade` retains optimizer
   statistics, but _extended_ statistics are explicitly not preserved. There are no
   `CREATE STATISTICS` objects here, but there are now **six** expression indexes carrying their own
   statistics, and #4331 added two of them:

   - scraper dedup: `COALESCE(full_purchase_date, full_purchase_date_outbound)`
     (`2026-05-04T12-00-00.…:8-38`)
   - `idx_transactions_owner_effective_debit_date` on
     `(owner_id, COALESCE(debit_date_override, debit_date))`
   - `idx_documents_owner_vat_report_date` on `(owner_id, COALESCE(vat_report_date_override, date))`
     (both from `2026-08-31T10-00-00.add-tenant-scoped-date-indexes.ts`)

   The two new ones are directly in the path of the date-range filters that #4331 just made
   sargable, so stale statistics on them would regress the query shapes that PR was written to fix.
   A plain `ANALYZE` over `accounter_schema` is minutes and removes the question.

4. **Re-assert the RLS invariants.** These are the ones that would hurt, and dev/CI cannot tell you
   anything about them because dev and CI connect as `postgres` — a superuser with `BYPASSRLS`
   (acknowledged in `packages/server/src/__tests__/helpers/rls-role.ts:6-9`). Production's model
   exists only in prose: `prod_group` owns `tags` and `extended_tags`, `extended_charges` has a
   different owner (`accounter_prod_user`), `FORCE ROW LEVEL SECURITY` is load-bearing because a
   table owner otherwise bypasses its own RLS, and no view sets `security_invoker`
   (`docs/coherent-owner-scoping-for-mcp/plan.md:51-108`,
   `packages/mcp-server/docs/owner-scoping-review.md:81-86`). None of it is created or asserted by
   any migration. So verify on the upgraded server:

   ```sql
   SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
   WHERE rolname IN ('accounter_prod_user', 'prod_group');

   SELECT relname, relrowsecurity, relforcerowsecurity, relowner::regrole
   FROM pg_class WHERE relnamespace = 'accounter_schema'::regnamespace AND relrowsecurity;

   SELECT c.relname, c.relowner::regrole, c.reloptions   -- security_invoker must stay unset
   FROM pg_class c WHERE c.relnamespace = 'accounter_schema'::regnamespace AND c.relkind = 'v';
   ```

   Then run the existing `packages/migrations/src/__tests__/rls-all-tables.test.ts` against the
   restored server — it already builds a non-superuser role and checks every table. Note also that
   Azure changes role privileges across a major upgrade: after the upgrade, the first user created
   on the server with the ADMIN option holds administrative privileges over other roles. Re-check
   the `prod_group` / `accounter_prod_user` ownership split against that.

5. **Capture before/after plans** for the queries in Part 3.4. Every query in the app carries an
   implicit `owner_id = ANY (accounter_schema.get_current_business_scope())` from RLS
   (`2026-05-25T10-00-00.rls-multi-business-scope.ts:108`), and the planner can't see that array's
   length. Any shift in `ScalarArrayOpExpr` selectivity moves plans across the whole application at
   once rather than query by query, so a handful of baseline `EXPLAIN (ANALYZE, BUFFERS)` captures
   is worth more here than in a typical app. (`BUFFERS` is on by default in 18.)

   **#4331 raised the stakes here.** Its four new indexes are all composite and all **lead with
   `owner_id`** — the very column whose selectivity the planner has to guess through
   `get_current_business_scope()`. Before that PR the date filters were non-sargable and no index
   could serve them, so a misestimate cost little; now the intended plans depend on those indexes
   being chosen. Include at least one date-filtered charges query and one date-filtered documents
   query in the baseline set, and capture them on **current `main`**, not on a pre-#4331 checkout —
   a baseline taken against the old text-cast predicates measures a query shape that no longer
   exists.

6. **Regenerate pgTyped types against 18** (`yarn generate:sql`) and confirm no type drift. Codegen
   introspects a live database, so this is where any inference difference surfaces first.

---

## Part 3 — What the upgrade unblocks (separate PRs, not upgrade-day work)

Ordered by expected value. Each is independently shippable.

### 3.1 `uuidv7()` for new-row PK defaults — the best of these

Roughly 40 tables default their PK to `gen_random_uuid()` (v4, uniformly random) — including the
append-heavy ones: `charges`, `transactions`, `documents`, `ledger_records`, and every scraper raw
table. Random v4 PKs scatter every insert across the whole B-tree, causing page splits, poor cache
locality and extra WAL. PG18's `uuidv7()` is timestamp-ordered, so inserts land at the right-hand
edge of the index.

The change is well-scoped because **id generation is almost entirely a DB-side `DEFAULT`** — a
migration altering the default is the whole change for those tables, and mixing v4 and v7 values in
one column is fine. Five app-side sites generate UUIDs and must be left alone or considered
separately:

- `shared/helpers/deterministic-uuid.ts` (uuid v5) → `entity-ensure.provider.ts:48-72`. **Do not
  touch**: the determinism _is_ the idempotency mechanism for `ON CONFLICT (id) DO NOTHING`.
- `auth/providers/invitations.provider.ts:161`, `email-ingestion-control.provider.ts:255-257`
  (`jti`), `email-ingestion-ingest.provider.ts:311,449,484-485,719` — low volume, no urgency.

Trade-off to state in the PR: `uuidv7()` embeds creation time, so ids stop being opaque about when a
row was made. For internal accounting ids that's typically fine, but it's a deliberate choice.

### 3.2 Temporal constraints for `clients_contracts`

`clients_contracts` stores `client_id`, `start_date`, `end_date`
(`2025-08-11T11-45-42.clients-contracts-table.ts:12-39`) with **no protection against two
overlapping contracts for the same client** — today that invariant is either enforced in application
code or not at all. PG18's `WITHOUT OVERLAPS` moves it into the database:

```sql
ALTER TABLE accounter_schema.clients_contracts
  ADD CONSTRAINT clients_contracts_no_overlap
  UNIQUE (client_id, daterange(start_date, end_date, '[]') WITHOUT OVERLAPS);
```

Backfill caveat: this fails if overlapping rows already exist, so the migration needs a detection
query first and a decision about existing data. Worth checking production for violations before
committing to it.

### 3.3 `NOT NULL NOT VALID` for future migrations

205 migrations run during deploy, blocking (see the caveat in Part 2 about confirming exactly
where). On 16, adding `NOT NULL` to a large table requires a full blocking validation scan. PG18
allows `NOT NULL NOT VALID` plus a later `VALIDATE CONSTRAINT`, splitting that into a fast metadata
change and a non-blocking validation. This is a convention to document rather than code to write —
the natural home is `packages/migrations/README.md`, alongside the existing guideline that
"migrations should not take too long to run".

Same doc should note the PG18 generated-column default: from 18 on, `GENERATED ALWAYS AS (expr)`
without `STORED` means **VIRTUAL** (recomputed on read). There are no generated columns today, so
this is purely forward-looking — but it's the kind of default change that silently surprises whoever
writes the first one.

### 3.4 Skip scan — real candidates, on the scraper hot path

PG18's B-tree skip scan uses a multicolumn index when a _leading_ column is unconstrained but later
ones are. Four dedup queries have exactly that gap today and can only use a prefix of their index:

| Query                                                 | Index                                                                                                                                     | Gap                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `foreign-securities.provider.ts:79-92`                | `poalim_securities_transactions_dedup_uindex (owner_id, bank_number, branch_number, account_number, security, trade_date, value_date, …)` | `trade_date` skipped, `value_date` supplied — the best candidate in the repo |
| `poalim-scraper-ingestion.provider.ts:92-94`          | `poalim_ils_account_transactions_dedup_uindex (event_date, serial_number, account_number, branch_number)`                                 | `serial_number` skipped                                                      |
| `otsar-hahayal-scraper-ingestion.provider.ts:155-158` | `otsar_hahayal_foreign_account_transactions_conflict_key (account, branch, date, value_date, reference, description)`                     | `value_date` skipped, `reference` supplied                                   |
| `poalim-scraper-ingestion.provider.ts:391-395`        | securities dedup index                                                                                                                    | prefix + `security` + `trade_date`, `owner_id` supplied only by RLS          |

These may simply get faster with no code change — which is the point. `EXPLAIN` them on the upgraded
clone before adding any index; skip scan may make a planned index unnecessary, and it may also make
some existing single-column indexes redundant against their composite siblings. Measure before
dropping anything.

### 3.5 `RETURNING old.* / new.*`

Useful at the 8 `ON CONFLICT … DO UPDATE` sites and for audit logging: capture before-and-after in
one statement instead of SELECT-then-UPDATE, which also closes the race between the two. Worth being
precise about the limit — this does **not** help the 55 `ON CONFLICT … DO NOTHING` sites, since no
row is processed there and `RETURNING` stays empty.

### 3.6 Observability

PG18 adds `pg_stat_all_tables.total_vacuum_time` / `total_analyze_time` (and autovacuum variants),
byte-level columns in `pg_stat_io`, per-index lookup counts in `EXPLAIN ANALYZE`, `log_connections`
granularity and a `%L` client-IP log prefix. The pool heartbeat in `observability/pool-monitor.ts`
is currently client-side only; a DB-side counterpart would pair well with the diagnosis queries
already in `docs/operations/db-connection-pool.md`. Check which of these are exposed as Azure
**server parameters** before planning on the logging ones — Flexible Server withholds a number of
GUCs, and `log_connections` granularity in particular is worth confirming rather than assuming.

### 3.7 Async I/O — set expectations honestly

PG18's AIO subsystem (`io_method`, `effective_io_concurrency` default raised to 16) speeds up
sequential and bitmap heap scans, which is the shape of the big free-text search and the
`extended_charges` view. But per `docs/all-charges-performance-boost/findings.md`, the measured
AllCharges baseline was **23.95s across ~290 sequential DB round trips** — a latency-bound,
app-level N+1 problem that AIO cannot touch. The app-side plan in that folder remains the
higher-leverage work. Note also that AIO has been the least settled part of 18 across minors, and
some reports tie it to connection-pool interactions; if Azure exposes `io_method` as a server
parameter, leave it at the default rather than tuning it as part of this upgrade.

---

## Part 4 — Other insights

### ✅ Resolved — the four findings that shipped

All four were found while surveying the SQL, none was upgrade-related, and all four merged on
2026-08-31 ahead of the production upgrade. Recorded here because they change what Part 2 must do,
and because the two correctness bugs affected historical output.

1. **`getLedgerBalanceToDate` dropped credit entity 2** — merged in
   [#4326](https://github.com/Urigo/accounter-fullstack/pull/4326). The four-branch `UNION` had two
   byte-identical branches (`credit_entity1, credit_local_amount1, invoice_date`, twice) while
   `credit_entity2` / `credit_local_amount2` appeared nowhere, so credit-side entity-2 amounts were
   silently missing from every balance it computed — a wrong number in an accounting application,
   not a slow query. **Note for the upgrade window:** this changes balances that were previously
   understated. Don't mistake a corrected balance for an upgrade regression when comparing
   before/after output.

2. **`$isUnmatched` lost its correlation** — merged in
   [#4327](https://github.com/Urigo/accounter-fullstack/pull/4327). In
   `NOT EXISTS (SELECT 1 FROM … transactions t WHERE t.charge_id = charge_id)` the unqualified
   `charge_id` resolved to the _inner_ `t.charge_id`, collapsing the predicate to "no transaction
   anywhere has a non-null charge_id" — the filter returned nothing as soon as any transaction was
   matched. Now correlated against `documents.charge_id`.

3. **Non-sargable date predicates** — merged in
   [#4331](https://github.com/Urigo/accounter-fullstack/pull/4331). This was the item that outranked
   every PG18 feature in Part 3, and it is done: the `::TEXT::DATE` round-trips are gone (verified —
   no `::TEXT::DATE` remains anywhere in `packages/server/src` or `packages/mcp-server/src`), and
   `2026-08-31T10-00-00.add-tenant-scoped-date-indexes.ts` backs the filters with four composite
   `(owner_id, <date>)` indexes, two of them over `COALESCE(...)` expressions. `COALESCE` over two
   date columns is immutable and therefore a legal index expression, which the old `::TEXT::DATE`
   form was not. See Part 2 checks 3 and 5 for the consequences.

4. **`financial_entities.name` trigram index** — merged in
   [#4330](https://github.com/Urigo/accounter-fullstack/pull/4330).
   `idx_financial_entities_name_trgm` (GIN, `gin_trgm_ops`, built `CONCURRENTLY`) now serves the six
   counterparty-name `ILIKE '%…%'` branches in the charges free-text filter that previously fell
   back to a sequential scan against a plain btree. The btree is deliberately kept for equality,
   prefix and ordering. **This is the seventh index in Part 2 check 1's `REINDEX` set.**

### ⬜ Still open

**The `.env`-points-at-production hazard is amplified by this work.** Already flagged in-repo at
`packages/mcp-server/docs/todo.md:116-124`: the root `.env` is what codegen, migrations, seeds and
DB-backed tests all read, so anything reading it "targets production by default". During an upgrade
you will be running codegen and migrations more than usual, often against PITR-restored servers.
Worth a guard before the upgrade window, not after. Concretely: Part 2 check 6 asks you to run
`yarn generate:sql` against the upgraded server, and `packages/server/scripts/set-db-url.cjs` builds
`DATABASE_URL` from whatever `POSTGRES_*` happens to be in `.env` — one stale value and a rehearsal
step runs against production instead.

**No backup, restore or replication tooling exists in the repo** — zero references to `pg_dump`,
`pg_restore`, `pg_basebackup`, publications or replication slots, and `package.json:42`'s
`seed:reset-staging` is an `echo` placeholder. The cutover is entirely Azure-managed, and a PITR
restore to a new server is the only rollback once the upgrade succeeds. This is a sharper gap on
Azure than it would be on a platform that leaves the old version running: an in-place `pg_upgrade`
converts the server in place, so "discovered days later" means restoring to a new server with a new
hostname and cutting over, bounded by the backup retention window. Worth deciding the retention
setting and a manual `pg_dump` before the window, not after.

**Version-skew direction matters — now resolved, keep it that way.** Because dev/CI and production
are pinned independently, Part 1 went first (#4329). Dev and CI are on 18 while production is still
on 16, which is the harmless direction: queries are validated against the newer parser and planner.
The dangerous inversion — production on 18 while CI validates against 16 — is now only reachable by
reverting #4329, so don't.

---

## Verification

1. **Part 1 locally:** `rm -rf .accounter-dev/postgresql/db && yarn local:setup` — confirms the 18
   container starts with the new mount, `db:init` applies all 205 migrations cleanly on 18, and
   `yarn generate` produces no pgTyped diff. Then `yarn test` and `yarn test:integration`.
2. **Part 1 in CI:** push the branch and confirm `server-tests.yml` (service container) and any
   workflow using `.github/actions/setup` with `localDB`/`pgTyped` both go green. The setup action
   is the one that would fail on the PGDATA symlink, so a green run there is the real signal.
3. **RLS on 18:** `yarn workspace @accounter-helper/migrations test` to exercise
   `rls-all-tables.test.ts`, which creates a non-superuser role and checks every table's policy.
4. **On the upgraded PITR-restored server:** work Part 2's post-upgrade checklist — collation
   provider, trgm reindex decision, `ALTER EXTENSION`, `ANALYZE`, the three RLS catalog queries, the
   `rls-all-tables` suite, a real free-text search from the UI, and one full scrape-ingestion batch.
   Record the upgrade duration as the production estimate.
5. **Plan baselines:** `EXPLAIN (ANALYZE, BUFFERS)` on `getChargesByFilters`
   (`charges.provider.ts:211`), the `extended_charges` consumer
   (`accountant-approval.provider.ts:12-20`), the creditcard LATERAL self-join
   (`creditcard-transactions.provider.ts:10-27`), and the four Part 3.4 dedup queries — captured on
   16 and again on the 18 clone.
6. **Standard gates:** `yarn lint`, `yarn prettier:check`, `yarn generate` before committing.
