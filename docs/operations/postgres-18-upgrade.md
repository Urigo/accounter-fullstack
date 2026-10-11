# Postgres 16 → 18 Upgrade — Runbook

Production runs **Azure Database for PostgreSQL — Flexible Server**. Azure performs the upgrade
itself with `pg_upgrade` behind an in-place major-version-upgrade button, and its docs cover the
mechanics well. This runbook is the part Azure's docs do not cover: the checks that are specific to
_this_ schema, and the two invariants that exist only in prose and would fail silently.

The SQL in this repo needs **no changes** to run on 18 — the incompatibility-by-incompatibility
audit is in [`docs/postgresql-v18-migration.md`](../postgresql-v18-migration.md). Dev and CI are
already pinned to 18 (#4329), so the version skew currently runs in the safe direction: queries are
validated against a newer parser and planner than production. Do not let production overtake them.

## ✅ EXECUTED — production upgraded 2026-09-02

Production is on **PostgreSQL 18.6**. This runbook is now a record as well as a procedure; the
sections below were followed as written except where noted.

|                                          |                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rehearsal (PITR-restored copy)           | 17m 54s, all 11 checks passed                                                                                                                                                                                                                                                   |
| **Production upgrade**                   | 16.14 → **18.6**                                                                                                                                                                                                                                                                |
| `ANALYZE` after upgrade                  | **5.2s** — mandatory, ran immediately                                                                                                                                                                                                                                           |
| `datcollversion`                         | **2.38 → 2.38, no drift.** Same base image (gcc 13.2.0 both). No text-index reindex needed                                                                                                                                                                                      |
| Trigram reindex                          | **Not required** (`datlocprovider = 'c'`), not run                                                                                                                                                                                                                              |
| Catalog diff (same server, before/after) | **All 7 security-relevant sections byte-identical.** Azure's ADMIN-option privilege change altered nothing — RLS coverage 101/60/60, ownership, `security_invoker` unset, role attributes, `prod_group → accounter_prod_user INHERIT TRUE`, `get_current_*` ownership, policies |
| Plan diff                                | **No regressions.** Skip scan now live on the two securities dedup queries: `dedup_uindex` chosen, `value_date` indexed past unconstrained `trade_date`, `Rows Removed by Filter` 262/261 → **0**                                                                               |
| Trigram index sizes                      | **Roughly halved** by the upgrade (e.g. 3416 → 1352 kB); DB 105 → 99 MB despite two days more data. All indexes valid. Mechanism not established                                                                                                                                |
| UI free-text search, scrape batch        | Both verified on production                                                                                                                                                                                                                                                     |
| Deploys                                  | Frozen for the window, unfrozen after                                                                                                                                                                                                                                           |

**Three things the rehearsal caught that would have hit the window:** a pending-restart
`max_connections` failing the precheck (a PITR-restore artifact — production was clean), restored
servers arriving with **no firewall rules**, and the `ANALYZE`-before-plan-captures ordering trap.

**Still open:** issue #4341 (two indexes unusable under RLS — unaffected by the upgrade, confirmed
on 18), and the production/migration schema drift documented in the baselines README.

## The failure modes this guards against

Ordered by how quietly they fail.

1. **RLS silently stops isolating tenants.** The production authorization model is _not created by
   any migration_. `prod_group` owns `tags` and `extended_tags`, `extended_charges` has a different
   owner (`accounter_prod_user`), and `FORCE ROW LEVEL SECURITY` is load-bearing because a table
   owner otherwise bypasses its own policies. Azure additionally changes role privileges across a
   major upgrade: afterwards, the first user created on the server holding the ADMIN option has
   administrative privileges over other roles. Nothing in dev or CI can warn you, because both
   connect as `postgres` — a superuser with `BYPASSRLS` (see
   `packages/server/src/__tests__/helpers/rls-role.ts`). A regression here is a cross-tenant data
   leak that returns HTTP 200.
2. **Free-text search degrades or changes behaviour.** PG18 changed full-text search and `pg_trgm`
   to use the cluster's default collation provider instead of always libc. The entire
   charges/transactions/documents/counterparty search is `ILIKE '%…%'` served by seven GIN trigram
   indexes — `charges.provider.ts:213` states the strategy outright ("Identify IDs via Trigram
   indexes before doing any heavy math"). Wrong or stale indexes here mean wrong search results, not
   just slow ones.
3. **Plans shift everywhere at once.** Every query carries an implicit
   `owner_id = ANY (accounter_schema.get_current_business_scope())` from RLS
   (`2026-05-25T10-00-00.rls-multi-business-scope.ts:108`), and the planner cannot see that array's
   length. Any change in `ScalarArrayOpExpr` selectivity moves plans across the whole application
   simultaneously rather than query by query. #4331 raised the stakes: its four new indexes all
   _lead_ with `owner_id`.
4. **A deploy lands mid-upgrade.** The migration runner takes **no advisory lock**
   (`packages/migrations/src/pg-migrator.ts`). If migrations run on deploy, a deploy that starts
   while the database is unavailable fails partway through them.
5. **Regret after a successful upgrade.** There is no revert. See [Rollback](#rollback) — it is
   weaker than it looks, and knowing that _before_ the window is the point.

## Before the window

### Step 0 — run Azure's Upgrade Validation Checks

Do this first, and days early. Flexible Server has a first-class pre-flight check that runs Azure's
real compatibility rules against the actual server without touching it — no downtime, no restart, no
version change:

```sh
# set RG and SERVER for your environment first
az postgres flexible-server upgrade-validate \
  --resource-group "$RG" --name "$SERVER" --version 18
```

It is authoritative in a way this document cannot be, because the blocking rules vary by
source/target pair and change over time. **Treat a clean validation run, not this checklist, as the
go/no-go.** Requirements: server status `Ready`, no other operation in progress, connectivity to
every database on the server; it cannot run against a read replica.

Our schema is expected to come back clean. Verified against Azure's blocker list on current `main`:

| Azure blocker                             | This schema                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Blocked/utility extensions                | `pg_trgm` only (`2026-03-23T12-00-00.index-search-strings.ts:7`) — on none of Azure's lists                         |
| `EVENT TRIGGER`s                          | None. (The 20 `AFTER` triggers are ordinary row/statement triggers and are unaffected.)                             |
| Views depending on `pg_stat_activity`     | None — the only two references are a comment (`server/src/index.ts:40`) and a `pg_terminate_backend` call in a test |
| Objects depending on `pg_stat_statements` | None; no monitoring-catalog reads in app code                                                                       |
| Large objects (`pg_largeobject`)          | None                                                                                                                |
| PostGIS / TimescaleDB                     | Not used                                                                                                            |

### Environment facts — confirmed on the portal 2026-09-01

Several generic prerequisites below do **not apply to this server**. Checked rather than assumed:

| Fact                 | Value                                                                                                                                   | Consequence                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compute tier         | **Burstable, 1 vCore** (B1ms), West Europe, availability zone 2                                                                         | See CPU credits below                                                                                                                                     |
| Storage              | 32 GB provisioned, **105 MB used (~0.3%)**                                                                                              | ≥10–20% free requirement trivially met — **no action**                                                                                                    |
| Read replicas        | **None.** The single row on the Replication blade is the primary itself (Role = `Primary`)                                              | No delete/re-create cycle — **the item that could have added days is gone**                                                                               |
| High availability    | **Disabled**, status `Not enabled`. Portal: _"Enabling zone redundant high availability is not supported with the chosen compute tier"_ | No HA disable/re-enable cycle; **no spare-standby capacity requirement**; and the NSG ports 5432/6432 + outbound-Azure-Storage concern **does not apply** |
| CPU credits          | **288 / 288**, flat at the cap for 18+ hours                                                                                            | Full burst bank (~288 vCore-minutes). Not a constraint; no need to match credit state between rehearsal and production                                    |
| Entra authentication | Enabled                                                                                                                                 | Verify after the upgrade alongside the RLS role checks — Azure's ADMIN-option change interacts with role membership                                       |
| Collation            | `datlocprovider = 'c'` (libc), `datcollate = en_US.utf8`, `datcollversion = 2.38`                                                       | Trigram reindex **not required**, only prudent. But see § 1b — a `datcollversion` change is a finding                                                     |

**What having no HA costs you:** the SLA is 99.9% rather than 99.99%, and there is no standby to
fall back on. That does not change the upgrade itself — an in-place major version upgrade takes the
server down regardless of HA — but it means Azure's implicit pre-upgrade backup is the _only_ safety
net if the upgrade fails mid-flight. Budget accordingly; do not treat "HA is off" as making the
window lower-risk.

**A correction on parallelism:** PG18's parallel GIN build (`enable_parallel_gin_build`,
`max_parallel_maintenance_workers`) is cited elsewhere in this document as making a reindex faster.
On **1 vCore** there is no parallelism to exploit, so that reassurance does not apply here. Moot in
practice, since the reindex is not required.

### ⛔ Pending-restart parameters block the upgrade — check this first

Hit for real on the rehearsal server, 2026-09-01:

```json
{
  "code": "MajorVersionUpgradeFailedPrecheck",
  "message": "The major version upgrade failed precheck. Upgrading with pg_settings pending restart
              is not allowed: found setting with name max_connections and current value 100."
}
```

Azure refuses a major version upgrade while **any** server parameter is staged awaiting a restart.

**Resolved 2026-09-01: this is an artifact of the PITR restore, not a property of production.**
Checked both servers with the query below — production returned **0 rows**; the restored server had
`max_connections = 100`, `source = configuration file`, `pending_restart = t`. So PITR provisioning
stages the parameter and never restarts, and a freshly restored server cannot be upgraded until it
is. Production would not have failed this precheck.

Check it anyway before the window: a parameter can be staged at any time by anyone editing the
portal, and nothing in the application surfaces it. A validation run from days earlier is stale
evidence.

```sql
SELECT name, setting, unit, source, pending_restart
FROM pg_settings
WHERE pending_restart;
```

An empty result means nothing is staged and the precheck will not trip on this. Any row is a
blocker. The portal equivalent is **Settings → Server parameters**, which flags staged values.

**The fix is a restart** (portal → Overview → **Restart**), which applies the staged value and
clears the flag. Two consequences for the production window:

- A restart is **downtime on top of the upgrade downtime**. If production has a pending parameter,
  budget for it and do the restart _ahead of_ the window rather than discovering it at the precheck.
- Nothing in the app warns you a parameter is staged. It can sit pending indefinitely after someone
  edits a parameter in the portal and does not restart — which is precisely how this becomes a
  window-day surprise.

**Also note for the rollback path:** a PITR-restored server may come up with parameters staged
pending restart, so a recovery restore needs a restart before it is consistent — on top of
recreating its firewall rules (see Rollback).

### Prerequisites

| Check                          | Why it matters                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **≥10–20% free storage**       | Azure calls this out explicitly: temporary log files and metadata operations grow disk usage mid-upgrade, and insufficient space causes upgrade failure or rollback. Growing storage on Flexible Server is one-way — check early.                                                                                                                                                    |
| **Delete read replicas**       | In-place upgrade supports neither geo-replication nor read replicas. Every replica, including cascading ones, must be deleted before upgrading the primary and re-created after. This is the one item that cannot be done inside a short window.                                                                                                                                     |
| **HA capacity + NSG rules**    | If HA is enabled, Azure disables it, upgrades the primary, then re-enables it — which needs spare capacity for a new standby. Confirm NSG rules permit ports **5432 and 6432** within the VNet and outbound to Azure Storage for log archiving; otherwise HA silently fails to re-enable and you finish the window with no standby.                                                  |
| **Upgrade logs on**            | Set `logfiles.download_enable = ON` and a sane `logfiles.retention_days`, then read `PG_Upgrade_Logs` during the run. This is the only real visibility into a stalled upgrade.                                                                                                                                                                                                       |
| **Connection username format** | If this server was ever automigrated from Single Server, the `username@servername` login format stops working after an in-place major upgrade — only plain `username` is accepted. Our connection string is assembled from `POSTGRES_USER` (`packages/server/scripts/set-db-url.cjs`, `environment.ts:319`), so check that value across server, migrations, MCP server and scrapers. |
| **Minor version**              | Nothing to choose: Azure automatically deploys the latest supported minor, so there is no 18.0 risk. **Record what you actually landed on.** For context: 18.1 fixed an OOM in parallel GIN index builds, 18.3 was an out-of-cycle release fixing regressions including a standby freeze, 18.5 was never released, 18.6 (2026-08-13) is current.                                     |

### Freeze Render deploys for the window

**The architecture is split, which is why two vendors appear in this document: the backend is
deployed on Render, the Postgres database is on Azure.** Confirmed 2026-08-31.

Production migrations **do** run inside the Render build command, against the Azure database. The
command as of 2026-08-31:

```sh
yarn install --immutable && npx playwright install && yarn db:migrate && yarn server:build:prod
```

- **Freeze Render deploys for the whole window.** The migration runner takes **no advisory lock**
  (`pg-migrator.ts`) and the database is unavailable for part of the upgrade.
- **The `&&` chaining is load-bearing — check it is still there before the window.** It means a
  deploy that lands mid-upgrade _aborts_: `yarn db:migrate` fails, `yarn server:build:prod` never
  runs, and the previously deployed server keeps serving. Until 2026-08-31 these steps were joined
  by `;`, under which a failed migration did **not** stop the deploy — the new server shipped with
  migrations unapplied, silently. If anyone reverts that, the failure mode goes back to being
  invisible.
- Aborting is much better than shipping, but it is not free: migrations are applied one at a time
  with no transaction spanning them (and the two most recent use `noTransaction` for
  `CREATE INDEX CONCURRENTLY`), so an interrupted run can leave the schema **partially migrated**
  while the old code serves. Freeze anyway; do not rely on `&&` as a substitute.
- The upgrade itself needs no application config or code deploy: an Azure in-place upgrade retains
  the server name, so Render's existing connection settings keep working untouched.
- Re-enable deploys only once the post-upgrade checks below have passed.

### Guard the root `.env` first

Tracked in-repo at `packages/mcp-server/docs/todo.md:116-124`: the root `.env` is what codegen,
migrations, seeds and DB-backed tests all read, so anything reading it targets production by
default. This window makes that materially more dangerous, because you will run codegen and
migrations more than usual and against a restored server — and
`packages/server/scripts/set-db-url.cjs` builds `DATABASE_URL` from whatever `POSTGRES_*` happens to
be in `.env`. One stale value and a rehearsal step runs against production.

Point the root `.env` at local and keep production credentials in a separate, explicitly named file
**before** the window.

This is not hypothetical. It bites in ordinary use, twice observed:

- `scripts/vitest-global-setup.ts` runs before **every** vitest project, `--project unit` included.
  It connects via the same `test-db-config.ts` (which loads `.env` / `../../.env`) and executes
  `seedCountries(client)` — a write. "I only ran unit tests" is not a reason to skip an override.
- `packages/migrations/src/__tests__/rls-all-tables.test.ts` opens the `postgres` database on
  whatever host `.env` names and issues `CREATE DATABASE`. Against production this fails only
  because `accounter_prod_user` lacks `CREATEDB` — luck, not a safeguard. Had the role been
  stronger, the next step was `runPGMigrations` against that server.

During the window, `.env` is also the thing most likely to be edited repeatedly (local → restored
server → local), so its contents change under you. Re-check it in the same breath as the command:

```sh
grep '^POSTGRES' .env # confirm the target, every time
POSTGRES_HOST=localhost POSTGRES_DB=accounter POSTGRES_USER=postgres POSTGRES_SSL=0 yarn test
```

A `.env` you verified an hour ago is not evidence about the `.env` you have now.

**There is now a guard for this** (`packages/migrations/src/local-db-guard.ts`). The test harness,
the vitest global setup, the RLS suite and both seed scripts **refuse** a non-local host unless
`ALLOW_REMOTE_DB=1` is set for that command. `migration:run` only **warns** — deliberately, because
production deploys may apply migrations during the build and that path is still unconfirmed (see
above); export `ENFORCE_LOCAL_DB=1` in your shell profile to make it strict for you.

The guard inspects the configured host only. A port-forward or tunnel presenting a deployed database
as `localhost` passes it. It raises the floor; it is not a sandbox — so keep checking `.env` too.

## Rehearsal

This is the whole risk-reduction strategy; do not skip it.

1. **PITR-restore production to a new server.** Azure restores to a new server, never in place.
2. **Upgrade that server** with the same in-place upgrade you intend to run on production.
3. **Run every check** in [Post-upgrade checks](#post-upgrade-checks--ours-not-azures) against it,
   plus two things no catalog query covers: a real free-text search from the UI, and one full
   scrape-ingestion batch.
4. **Record the duration.** This is the production estimate — there is no better source for it.
5. **Delete the restored server** once you are done, so it does not linger as a stale copy of
   production data.

## Post-upgrade checks — ours, not Azure's

Run these on the rehearsal server first, then again on production after the real upgrade.

### 1. Collation provider, then the trigram reindex

PG18 changed FTS and `pg_trgm` to use the cluster's default collation provider instead of always
libc. Upstream: clusters defaulting to a _non-libc_ provider "could observe changes in behavior of
some full-text search functions, as well as the `pg_trgm` extension", and should reindex FTS and
`pg_trgm` indexes after `pg_upgrade`. Check which case you are in:

```sql
SELECT datname, datlocprovider, datcollate, datctype
FROM pg_database WHERE datname = current_database();
```

**Measured on production 2026-08-31: `datlocprovider = 'c'` (libc), `datcollate = en_US.utf8`.** So
the trigram reindex is **not required** for this cluster — it drops to cheap insurance. Re-check
after the upgrade anyway rather than trusting this line.

#### 1b. The collation _version_ — a different and much broader risk

Do not confuse this with the provider question above. Separately from PG18's `pg_trgm` change,
Postgres records the version of the collation library the database was built against. If the upgrade
moves the server to a base image with a different glibc, that version changes, and **every index
whose ordering depends on collation is potentially mis-sorted** — all btree indexes on
`text`/`varchar`, unique constraints on text columns, and anything comparing strings. That is a far
bigger job than seven trigram indexes.

Production was on glibc **2.38** before the upgrade (`datcollversion`, captured in the baseline
snapshot). Check both the database default and any non-default collations:

```sql
-- database default: stored version vs what the OS now provides
SELECT datname, datcollate, datcollversion,
       pg_database_collation_actual_version(oid) AS actual_version
FROM pg_database WHERE datname = current_database();

-- any individual collation whose stored version no longer matches reality
SELECT collname, collversion, pg_collation_actual_version(oid) AS actual_version
FROM pg_collation
WHERE collversion IS NOT NULL AND collversion <> pg_collation_actual_version(oid);
```

`datcollversion = actual_version` and an empty second result ⇒ nothing to do. **A mismatch, or a
`WARNING: database "…" has a collation version mismatch` in the logs, means:**

1. `REINDEX DATABASE accounter_prod_db;` — or at minimum every btree index on a text column. This is
   not `CONCURRENTLY`-capable at database scope, so plan it as downtime or reindex table by table
   with `REINDEX INDEX CONCURRENTLY`.
2. Then `ALTER DATABASE accounter_prod_db REFRESH COLLATION VERSION;` to clear the warning — **only
   after** the reindex. Refreshing first hides the problem without fixing it.

Two caveats:

- **This cannot be rehearsed on the local dev container.** `postgres:18-alpine` uses musl, which
  reports no collation version at all (`datcollversion` comes back empty), whereas production is
  glibc. Verify it on the PITR-restored rehearsal server, which is a real Azure instance.
- The rehearsal is the _only_ early warning you get. If the restored server's `actual_version`
  differs from 2.38 after being upgraded to 18, expect the same on production and budget the reindex
  into the window.

`datlocprovider = 'i'` (ICU) or `'b'` (builtin) → reindex is **required**. `'c'` (libc) → not
required. Either way there are only seven indexes and this is cheap insurance:

```sql
REINDEX INDEX CONCURRENTLY accounter_schema.idx_charges_desc_trgm;             -- charges.user_description
REINDEX INDEX CONCURRENTLY accounter_schema.idx_trans_src_trgm;                -- transactions.source_description
REINDEX INDEX CONCURRENTLY accounter_schema.idx_trans_src_ref_trgm;            -- transactions.source_reference
REINDEX INDEX CONCURRENTLY accounter_schema.idx_docs_desc_trgm;                -- documents.description
REINDEX INDEX CONCURRENTLY accounter_schema.idx_docs_remarks_trgm;             -- documents.remarks
REINDEX INDEX CONCURRENTLY accounter_schema.idx_docs_serial_trgm;              -- documents.serial_number
REINDEX INDEX CONCURRENTLY accounter_schema.idx_financial_entities_name_trgm;  -- financial_entities.name
```

**Use the tool rather than the list.** `yarn db:reindex-trgm` discovers every trigram index from
`pg_index`/`pg_opclass` at runtime, always emits `CONCURRENTLY`, reports the collation provider,
flags invalid indexes and `_ccnew` leftovers from a previously failed rebuild, times each index, and
re-reads the catalog afterwards to confirm validity:

```sh
yarn db:reindex-trgm --dry-run # list what would be rebuilt, change nothing
yarn db:reindex-trgm --confirm # rebuild
```

It takes its target from `POSTGRES_*` like everything else, so set those to the upgraded server
explicitly. The SQL below is the same work by hand, kept for when you would rather not run a script
against production — but note the list is a snapshot and the tool is not.

Two things to get right here:

- **All seven, including the last** — the reason to prefer the tool.
  `idx_financial_entities_name_trgm` was added recently (#4330,
  `2026-08-31T11-00-00.index-financial-entity-names.ts`) for the six counterparty-name `ILIKE`
  branches of the charges free-text filter. It is as exposed to the collation change as the original
  six. An older copy of this list has only six entries.
- **`CONCURRENTLY` regardless of how they were built.** Only the seventh was originally created
  concurrently; the first six came from a plain `CREATE INDEX IF NOT EXISTS`
  (`2026-03-23T12-00-00.index-search-strings.ts`). A plain `REINDEX` takes `ACCESS EXCLUSIVE` and
  would block writes to `charges`, `transactions` and `documents` for the duration.

PG18 adds parallel GIN builds (`enable_parallel_gin_build`, `max_parallel_maintenance_workers`), so
the rebuild is faster than it would have been on 16.

Afterwards, confirm nothing was left invalid — a `CONCURRENTLY` build that fails part-way leaves an
index the planner silently ignores:

```sql
SELECT c.relname, i.indisvalid, i.indisready
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'accounter_schema' AND NOT (i.indisvalid AND i.indisready);
```

### 2. Verify the extension version

```sql
SELECT extname, extversion FROM pg_extension;
```

Azure auto-upgrades most extensions during an in-place major upgrade, so unlike a bare `pg_upgrade`
this should already be current. Run `ALTER EXTENSION pg_trgm UPDATE;` only if the version is behind
what 18 ships — it is idempotent and harmless either way.

### 3. `ANALYZE` — required, not optional

Azure documents this as a required post-upgrade step: run `ANALYZE` in each database to refresh
`pg_statistic`, because missing or stale statistics cause bad plans and excess memory use.

```sql
ANALYZE;  -- or: ANALYZE VERBOSE; scoped per table if you want progress
```

PG18's `pg_upgrade` retains optimizer statistics, but _extended_ statistics are explicitly not
preserved. There are no `CREATE STATISTICS` objects here, but there are six **expression** indexes
carrying their own statistics, and two are new:

- `COALESCE(full_purchase_date, full_purchase_date_outbound)` — scraper dedup
  (`2026-05-04T12-00-00.…:8-38`)
- `idx_transactions_owner_effective_debit_date` on
  `(owner_id, COALESCE(debit_date_override, debit_date))`
- `idx_documents_owner_vat_report_date` on `(owner_id, COALESCE(vat_report_date_override, date))`

The latter two arrived with #4331 (`2026-08-31T10-00-00.add-tenant-scoped-date-indexes.ts`) and sit
directly in the path of the date-range filters that PR made sargable. Stale statistics on them would
regress exactly the query shapes it was written to fix.

### 4. Re-assert the RLS invariants

The load-bearing check. These four queries are the ones already verified against production
(`docs/coherent-owner-scoping-for-mcp/plan.md:51-108`); re-run all four and compare against the
expected values, do not eyeball them:

```sql
-- 1. view owner → prod_group
SELECT viewowner FROM pg_views
WHERE schemaname = 'accounter_schema' AND viewname = 'extended_tags';

-- 2. owner cannot bypass RLS → rolsuper = f, rolbypassrls = f
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
WHERE rolname IN ('prod_group', 'accounter_prod_user');

-- 3. RLS ENABLED *and FORCED* on the base table → tags: t / t
--    (also charges: t/t, tax_categories: t/t)
SELECT c.relname, pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'accounter_schema' AND c.relname IN ('tags', 'extended_tags');

-- 4. policy resolves through a session GUC, not current_user
SELECT policyname, qual FROM pg_policies
WHERE schemaname = 'accounter_schema' AND tablename = 'tags';
--   expect tenant_isolation:
--   owner_id = ANY (accounter_schema.get_current_business_scope())
```

Why each one, briefly — the reasoning was learned by running them, not by reading the schema:

- **Step 3 is the one that would fail quietly.** `prod_group` _owns_ `tags`, and a table owner
  bypasses its own RLS policies unless `FORCE ROW LEVEL SECURITY` is set. Had `relforcerowsecurity`
  been `f`, the view would escape RLS with `rolsuper` and `rolbypassrls` both still `f` — i.e. steps
  2 and 4 green and the data leaking anyway.
- **`extended_charges` does not imply `extended_tags`.** Different owners (`accounter_prod_user` vs
  `prod_group`), so "the charges path works, therefore this works" does not transfer. Check each
  view's own owner.
- **No view sets `security_invoker`,** which is harmless _only_ because scope resolves through a
  session GUC rather than `current_user`: the policy evaluates identically whichever role executes
  the view. If that ever changes, this assumption goes with it.

Then confirm no view acquired `security_invoker` and no table lost RLS:

```sql
SELECT c.relname, pg_get_userbyid(c.relowner) AS owner, c.reloptions  -- security_invoker must stay unset
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'accounter_schema' AND c.relkind = 'v';
```

Finally, run the existing suite — it builds a genuine non-superuser role and checks every table:

```sh
# set RESTORED_HOST and ADMIN_USER for the PITR-restored server first
ALLOW_REMOTE_DB=1 \
  POSTGRES_HOST="$RESTORED_HOST" POSTGRES_DB=accounter_prod_db \
  POSTGRES_USER="$ADMIN_USER" POSTGRES_SSL=1 \
  yarn vitest run --project unit packages/migrations/src/__tests__/rls-all-tables.test.ts
```

Three things about that command:

- **`ALLOW_REMOTE_DB=1` is required.** The suite refuses a non-local host without it
  (`packages/migrations/src/local-db-guard.ts`), because it `CREATE DATABASE`s and runs every
  migration into the result. This is the one intended non-local use of that opt-in — type it
  deliberately, in the same command as the restored server's hostname.
- **Target it explicitly.** Bare, it uses the root `.env` — see the `.env` warning above. It must
  point at the restored server, not at production and not at local.
- **The role needs `CREATEDB`.** The test creates a throwaway database
  (`accounter_migration_test_rls_<ts>`), runs migrations into it, and drops it.
  `accounter_prod_user` cannot do this — use the server admin role, and confirm the throwaway
  database was dropped afterwards.

**Azure-specific:** after a major upgrade, the first user created on the server with the ADMIN
option holds administrative privileges over other roles. Re-check the `prod_group` /
`accounter_prod_user` split against that, not just against step 2's output.

### 5. Capture plan baselines

Capture `EXPLAIN (ANALYZE, BUFFERS)` for these on 16 **before** the window and again after
(`BUFFERS` is on by default in 18):

| Query                                                                      | Why                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------- |
| `getChargesByFilters` (`charges.provider.ts:211`)                          | The trigram-first search strategy, and the widest query |
| `extended_charges` consumer (`accountant-approval.provider.ts:12-20`)      | Big view, sequential/bitmap-scan shaped                 |
| Creditcard LATERAL self-join (`creditcard-transactions.provider.ts:10-27`) | Join-shape sensitive                                    |
| The four Part 3.4 dedup queries                                            | Skip-scan candidates on the scraper hot path            |
| One date-filtered charges query **and** one date-filtered documents query  | Exercises #4331's new `(owner_id, <date>)` indexes      |

Capture the last row's baselines on **current `main`**, not a pre-#4331 checkout: a baseline taken
against the old `::TEXT::DATE` predicates measures a query shape that no longer exists.

### 6. Regenerate pgTyped types against 18

```sh
yarn generate:sql
```

Codegen introspects a live database, so any type-inference difference surfaces here first. Expect
zero diff — this was already proven before #4329 merged, by generating against 16.10 and 18.6 and
comparing hashes over every `__generated__/*.types.ts`. Mind the `.env` warning above: this step
connects to whatever `POSTGRES_*` points at, and pgTyped is **not** behind the guard (it only reads,
so it was left unguarded) — making it the one step here with no safety net.

## If something looks wrong afterwards

| Symptom                                   | First check                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Search returns fewer/odd results          | `datlocprovider` and whether the seven trigram reindexes actually completed — plus the `indisvalid` query in check 1 |
| Search is slow but correct                | An invalid index the planner is ignoring (same query), or missing `ANALYZE`                                          |
| A tenant sees another tenant's rows       | Stop. Check 4, step 3 (`relforcerowsecurity`) first, then the Azure ADMIN-option role change                         |
| Broad slowdown across unrelated queries   | `ANALYZE` not run, or `ScalarArrayOpExpr` selectivity shift — compare against the check 5 baselines                  |
| Date-filtered charge/document lists slow  | Whether the four `(owner_id, <date>)` indexes from #4331 survived and are being chosen                               |
| App cannot connect at all                 | The `username@servername` format (see prerequisites), then NSG rules on 5432/6432                                    |
| No standby after the window               | HA failed to re-enable — NSG rules or insufficient capacity                                                          |
| Connections pile up `idle in transaction` | Unrelated to the upgrade: see [`db-connection-pool.md`](db-connection-pool.md)                                       |

A corrected balance is **not** a regression: #4326 fixed `getLedgerBalanceToDate`, which had been
dropping credit entity 2 from every balance it computed. Figures that changed there changed because
of that fix, not the upgrade.

## Rollback

Be precise about this, because it is weaker than it looks.

- **Failure _during_ the upgrade is well covered.** After a successful precheck and immediately
  before starting, Azure takes an implicit backup and can use it to restore the instance to its
  previous version on error.
- **Regret _after_ a successful upgrade is not.** There is **no automated way to revert**. Recovery
  is a PITR restore to a timestamp before the upgrade, which lands on a **new server with a new
  name** — a connection-string change and a real cutover, not a rollback.

> ### ⚠️ A PITR-restored server has NO firewall rules
>
> Observed 2026-09-01 while creating the rehearsal server: **Networking → Firewall rules came back
> empty**, even though the source server has rules. The restore does not carry them over.
>
> This is a hole in the rollback path above, not a rehearsal curiosity. If you ever PITR-restore
> production as a recovery, the restored server is **unreachable by everything** — Render, the
> scrapers, the MCP server, your laptop — until its firewall rules (and any private-endpoint or VNet
> configuration) are recreated by hand. Under outage pressure that is exactly the step that gets
> missed, and it presents as "the restore worked but nothing can connect".
>
> **Before the window:** screenshot or export the primary's firewall rules and networking
> configuration so they can be reapplied without having to reconstruct them from memory.
>
> ```sh
> az postgres flexible-server firewall-rule list -g "$RG" -n "$SERVER" -o table
> ```

Two consequences worth acting on before the window: confirm the backup retention window covers how
long a regression might plausibly go unnoticed, and take a manual `pg_dump` — the repo contains no
backup, restore or replication tooling at all (`package.json`'s `seed:reset-staging` is an `echo`
placeholder), so Azure's own backups are the only copy.

## Sign-off checklist

- [ ] `az postgres flexible-server upgrade-validate` clean
- [ ] ≥10–20% free storage; read replicas deleted; HA capacity and NSG rules confirmed
- [ ] `logfiles.download_enable = ON`
- [ ] `POSTGRES_USER` confirmed not in `username@servername` form
- [ ] Root `.env` pointed at local, prod credentials moved to a named file
- [ ] Where production migrations run: established
- [ ] Deploy freeze in effect
- [ ] Manual `pg_dump` taken; retention window confirmed
- [ ] Rehearsal done on a PITR-restored server; duration recorded as `______`
- [ ] Plan baselines captured on 16
- [ ] **Post-upgrade:** `datcollversion` compared against the 2.38 baseline — a change means
      reindexing every text index, then `ALTER DATABASE … REFRESH COLLATION VERSION` in that order
- [ ] **Post-upgrade:** minor version recorded; collation provider checked; seven trigram indexes
      reindexed `CONCURRENTLY` and all valid; extension version verified; `ANALYZE` run
- [ ] **Post-upgrade:** four RLS invariant queries re-run and compared; `security_invoker` still
      unset; `rls-all-tables` suite green; Azure ADMIN-option change reviewed
- [ ] **Post-upgrade:** `yarn generate:sql` produces no diff
- [ ] **Post-upgrade:** real free-text search from the UI; one full scrape-ingestion batch
- [ ] ~~Read replicas re-created; HA re-enabled with a standby present~~ — **N/A on this server**:
      no replicas, HA unavailable on Burstable (confirmed 2026-09-01)
