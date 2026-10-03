# Rehearsal command sheet — Step 4.3

Every check to run against the PITR-restored server, in order, with the expected result for each.
Parameterised by `$RESTORED_HOST`. Paste blocks in sequence.

Companion to `../postgres-18-upgrade.md`.

## ⚠️ Ordering rule — read this before anything else

**`ANALYZE` must run BEFORE the plan captures.** Not after, not "sometime during".

`pg_upgrade` does not preserve expression-index statistics. We already hit this on production:
before `ANALYZE`, the two `COALESCE` indexes estimated **51 rows vs 1671 actual** and **38 vs
1162**. The 16 baselines in this directory were captured _after_ `ANALYZE`. Capture the 18 plans
first and you will diff a post-`ANALYZE` 16 file against a pre-`ANALYZE` 18 file, see estimates
swing by 30×, and conclude PostgreSQL 18 changed the planner. It did not — you measured your own
missing statistics.

## ⚠️ Paste hazard

Do **not** paste a multi-line block containing `read`. zsh feeds the next pasted line into it as the
password. Step 0b is on its own for exactly this reason — paste it, press Enter, then type.

---

## 0a. Variables

```sh
cd /path/to/accounter-fullstack # your local checkout
BASE=docs/operations/postgres-18-baselines
RESTORED_HOST=$RESTORED_HOST # <-- set to the real hostname
A=$OWNER_A                   # owner for scope1
B=$OWNER_B                   # second business for scopeN
ADMIN_CONN="host=$RESTORED_HOST user=accounter_admin dbname=accounter_prod_db sslmode=require"
APP_CONN="host=$RESTORED_HOST user=accounter_prod_user dbname=accounter_prod_db sslmode=require"
```

PITR preserves roles and passwords, so both accounts work on the restored server unchanged.

## 0b. Passwords — paste each line alone, then type

```sh
printf 'accounter_admin password: '
read -rs PGADMIN
echo
echo "captured ${#PGADMIN} chars"
```

```sh
printf 'accounter_prod_user password: '
read -rs PGAPP
echo
echo "captured ${#PGAPP} chars"
```

Both must report a non-zero, plausible length. If either reads `0`, the paste ate it — redo.

## 0c. Confirm the restored server before upgrading it

```sh
docker exec -i -e PGPASSWORD="$PGADMIN" accounter-dev-db-1 psql "$ADMIN_CONN" -c "
  SELECT version();
  SELECT datname, datlocprovider, datcollate, datcollversion,
         pg_database_collation_actual_version(oid) AS actual_version
  FROM pg_database WHERE datname = current_database();"
```

**Expect:** PostgreSQL **16.x** (PITR restores the same major version — this is correct),
`datlocprovider = c`, `datcollversion = 2.38`, `actual_version = 2.38`.

If it already reports 18, you are pointed at the wrong server. Stop.

## 0d. Restart the restored server — REQUIRED before the upgrade

A PITR-restored server comes up with `max_connections` staged pending restart, and Azure refuses a
major version upgrade while any parameter is pending. Observed 2026-09-01: the upgrade failed
`MajorVersionUpgradeFailedPrecheck` for exactly this reason. Production was clean, so this is a
restore artifact — expect it on every restored server.

```sh
docker exec -i -e PGPASSWORD="$PGADMIN" accounter-dev-db-1 psql "$ADMIN_CONN" \
  -c "SELECT name, setting, source, pending_restart FROM pg_settings WHERE pending_restart;"
```

Any row → portal → `$RESTORED_HOST` → **Overview** → **Restart**. Wait for `Ready`, then re-run the
query and confirm it returns **0 rows** before continuing.

---

## 1. Upgrade the restored server — portal

Portal → `$RESTORED_HOST` → **Overview** → **Upgrade** → version **18** → Action **Validate and
upgrade** → **Start**.

Record:

- **Start (UTC):** `16:48:34` (2026-09-01)
- **Duration:** **17m 54s** ← the production estimate
- **Minor version landed on:** **18.6**

The first attempt at 19:37:05 IDT failed at precheck on the pending `max_connections` (step 0d) and
did no work, so it does not count toward the estimate.

**Budget the window, not just this number:** ~18 min upgrade + `ANALYZE` + any collation reindex +
the deploy freeze either side. Plan 30–40 minutes of unavailability, not 18.

Wait for status `Ready` before continuing.

---

## 2. Collation version — the check that can only be done here

Not rehearsable on the local container: `postgres:18-alpine` is musl and reports no collation
version at all.

```sh
docker exec -i -e PGPASSWORD="$PGADMIN" accounter-dev-db-1 psql "$ADMIN_CONN" -c "
  SELECT datname, datcollate, datcollversion,
         pg_database_collation_actual_version(oid) AS actual_version
  FROM pg_database WHERE datname = current_database();
  SELECT collname, collversion, pg_collation_actual_version(oid) AS actual
  FROM pg_collation
  WHERE collversion IS NOT NULL AND collversion <> pg_collation_actual_version(oid);"
```

**Expect:** `datcollversion = 2.38 = actual_version`, and an **empty** second result.

**If they differ** — the upgrade moved the server to a different glibc, and every index whose
ordering depends on collation is potentially mis-sorted: all btree indexes on `text`/`varchar`,
unique constraints on text, any string comparison. Remedy, **in this order**:

```sql
REINDEX DATABASE accounter_prod_db;                         -- not CONCURRENTLY-capable at DB scope
ALTER DATABASE accounter_prod_db REFRESH COLLATION VERSION; -- ONLY after the reindex
```

Refreshing first clears the warning while leaving the indexes wrong. Also check **Monitoring →
Server logs** for `database "…" has a collation version mismatch`.

---

## 3. ANALYZE — Azure-mandatory, and must precede the plan captures

```sh
time docker exec -i -e PGPASSWORD="$PGADMIN" accounter-dev-db-1 psql "$ADMIN_CONN" -c "ANALYZE;"
```

Seconds on 105 MB. Takes only `SHARE UPDATE EXCLUSIVE` — does not block reads or writes.

**Record the duration** — this step is mandatory on production too, so it belongs in the window
budget.

---

## 4. Catalog snapshot → diff against 16

```sh
docker exec -i -e PGPASSWORD="$PGADMIN" accounter-dev-db-1 psql "$ADMIN_CONN" \
  < $BASE/pre-upgrade-catalog.psql > $BASE/18-catalog-snapshot.txt 2>&1

diff -u $BASE/16-catalog-snapshot.txt $BASE/18-catalog-snapshot.txt
```

**Expected differences only:** `version()`, extension versions, index sizes, row counts,
`captured_at_utc`.

**Anything else is a finding** — in particular RLS coverage (must stay 101 tables / 60 enabled / 60
forced), the tables-without-RLS list, `FORCE` flags, view `reloptions` (`security_invoker` must stay
unset), role attributes and memberships, function ownership, and `datcollversion`.

`salaries` may have moved into the RLS-enabled set if PR #4340 has deployed — an intended change,
not a finding.

## 5. Plan captures → diff against 16

```sh
run() {
  docker exec -i -e PGPASSWORD="$PGAPP" accounter-dev-db-1 \
    psql "$APP_CONN" -v owner=$A -v scope="$1" \
    < $BASE/capture-plans.psql > "$2" 2>&1
  if grep -qiE 'FATAL|password authentication failed' "$2"; then
    echo "  ✗ $2 — connection failed, deleting"
    rm -f "$2"
  elif ! grep -q 'row-level security policy' "$2"; then
    echo "  ✗ $2 — RLS probe did NOT fire: capture INVALID"
  else
    echo "  ✓ $2 — $(wc -l < "$2") lines, RLS probe fired"
  fi
}

run "{\"$A\"}" $BASE/18-plans-scope1.txt
run "{\"$A\",\"$B\"}" $BASE/18-plans-scopeN.txt

diff -u $BASE/16-plans-scope1.txt $BASE/18-plans-scope1.txt
diff -u $BASE/16-plans-scopeN.txt $BASE/18-plans-scopeN.txt
```

Two `✓` lines required. The RLS probe must fire — a capture taken by a bypassing role carries no
`owner_id` predicate and is worthless.

**Reading the diff:**

| Observation                                                                          | Meaning                                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Same index chosen, similar estimates                                                 | No plan change. The expected outcome.                                                                        |
| A **dedup query** switches to a skip scan on 18                                      | The PG18 improvement landing. Good — record it.                                                              |
| `idx_transactions_owner_event_date` / `idx_documents_owner_date` **stop** being used | **Regression.** Investigate before the production window.                                                    |
| The two `COALESCE` queries still show `Filter` + `Rows Removed`                      | **Expected, not a regression** — issue #4341. RLS demotes the predicate on 18 too; verified locally on 18.6. |
| Estimates wildly off again                                                           | `ANALYZE` did not run, or ran after the capture. Redo in the right order.                                    |

Timings are not comparable across runs (cold vs warm cache). Compare **plan shape and estimates**.

## 6. Extension version

```sh
docker exec -i -e PGPASSWORD="$PGADMIN" accounter-dev-db-1 psql "$ADMIN_CONN" \
  -c "SELECT extname, extversion FROM pg_extension ORDER BY extname;"
```

Baseline was `pg_trgm 1.6` in `public`. Azure auto-upgrades most extensions, so expect it current.
Run `ALTER EXTENSION pg_trgm UPDATE;` only if it is behind what 18 ships — idempotent either way.

## 7. Trigram reindex — optional here, rehearse it anyway

`datlocprovider = 'c'` (libc), so this is **not required**. Worth running once to prove the tooling
works and to time it, rather than discovering both under pressure.

```sh
ALLOW_REMOTE_DB=1 POSTGRES_HOST="$RESTORED_HOST" POSTGRES_DB=accounter_prod_db \
  POSTGRES_USER=accounter_admin POSTGRES_PASSWORD="$PGADMIN" POSTGRES_SSL=1 \
  yarn db:reindex-trgm --dry-run

ALLOW_REMOTE_DB=1 POSTGRES_HOST="$RESTORED_HOST" POSTGRES_DB=accounter_prod_db \
  POSTGRES_USER=accounter_admin POSTGRES_PASSWORD="$PGADMIN" POSTGRES_SSL=1 \
  yarn db:reindex-trgm --confirm
```

**Expect:** 7 indexes discovered, collation provider reported as libc, all rebuilt `CONCURRENTLY`,
closing with "all valid". The tool is uncommitted — run from **this working tree**.

## 8. RLS invariants — the suite

```sh
ALLOW_REMOTE_DB=1 POSTGRES_HOST="$RESTORED_HOST" POSTGRES_DB=accounter_prod_db \
  POSTGRES_USER=accounter_admin POSTGRES_PASSWORD="$PGADMIN" POSTGRES_SSL=1 \
  yarn vitest run --project unit packages/migrations/src/__tests__/rls-all-tables.test.ts
```

Needs `CREATEDB`, hence `accounter_admin` and not the app role. It creates
`accounter_migration_test_rls_<ts>`, migrates into it, and drops it. **Confirm the throwaway
database is gone:**

```sh
docker exec -i -e PGPASSWORD="$PGADMIN" accounter-dev-db-1 psql "$ADMIN_CONN" \
  -c "SELECT datname FROM pg_database WHERE datname LIKE 'accounter_migration_test%';"
```

Empty result expected.

**Azure-specific:** after a major upgrade the first ADMIN-option user gains privileges over other
roles. Step 4's catalog diff covers `pg_roles` and memberships — read that section deliberately
rather than skimming it.

## 9. pgTyped drift

```sh
ALLOW_REMOTE_DB=1 POSTGRES_HOST="$RESTORED_HOST" POSTGRES_DB=accounter_prod_db \
  POSTGRES_USER=accounter_admin POSTGRES_PASSWORD="$PGADMIN" POSTGRES_SSL=1 \
  yarn generate:sql

find packages -path '*__generated__*' -name '*.types.ts' \
  -not -path '*/node_modules/*' -not -path '*/dist/*' | sort | xargs shasum | shasum
```

**Do not compare this hash to a baseline taken from a different schema.** pgTyped introspects the
live database, so the hash depends on the _schema_ as much as the version — and production's schema
has drifted from what the migrations build (see below). Comparing a production-schema hash to a
migration-built baseline conflates two variables and produces a false alarm. That is exactly what
happened on 2026-09-02.

Reference values for this tree:

| Source                                    | Hash                                       |
| ----------------------------------------- | ------------------------------------------ |
| Migration-built schema, PG16 **and** PG18 | `841666e6194a83d7e3fd2f29341ea585accc598b` |
| Production schema, PG16 **and** PG18      | `a5de15bc891f52ed824be15bbc4d67332443c02a` |

**Version-independence is proven in both directions** — 16 and 18 agree on each schema. So a
mismatch here means the _schema_ differs, not that PG18 changed type inference.

To test version drift properly, hold the schema constant: restore the production dump schema-only
into a throwaway PG16 (use the **18** client — a pg_dump 18 archive is format 1.16, which pg_restore
16 cannot read) and generate against both.

**Then regenerate against local**, so the working tree is not left holding types derived from a
temporary server:

```sh
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=accounter \
  POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres POSTGRES_SSL=0 yarn generate:sql
```

## 10. The two things no catalog query covers

- **A real free-text search from the UI**, pointed at the restored server. Exercises
  `getChargesByFilters` and all seven trigram indexes — the one query shape with no captured
  baseline. Use a **synthetic** search term, not a real customer name.
- **One full scrape-ingestion batch.** Exercises the four dedup queries and the `ON CONFLICT` paths.

Neither is scriptable from here, and together they are the difference between "the catalogs look
right" and "the application works".

---

## 11. Delete the rehearsal server

Portal → `$RESTORED_HOST` → **Overview** → **Delete**.

Leaving it running means an unmonitored full copy of production accounting data, billing at
production rates. Do this as soon as the record sheet is filled in.

```sh
unset PGADMIN PGAPP
```

---

## Record sheet

| Item                                  | Value                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upgrade duration                      | **17m 54s** (19:48:34 → ~20:06 IDT, 2026-09-01)                                                                                                                                                                                                                                                                                                 |
| Minor version landed on               | **18.6** — build string identical to 16.15 (gcc 13.2.0), i.e. same base image                                                                                                                                                                                                                                                                   |
| `ANALYZE` duration                    | **6.3s** — negligible; safe to run inside the window                                                                                                                                                                                                                                                                                            |
| `datcollversion` after upgrade        | **2.38, matches actual_version — no drift.** No broad reindex needed                                                                                                                                                                                                                                                                            |
| Catalog diff — unexpected differences | **NONE.** All 7 security-relevant sections byte-identical (RLS coverage, ownership, views/`security_invoker`, roles, memberships, `get_current_*`, policies). Only version, index sizes, row counts, db size, timestamp changed                                                                                                                 |
| Plan diff — changes found             | **Skip scan confirmed on 4a and 4c** — `dedup_uindex` now used with `value_date` in Index Cond after unconstrained `trade_date`; Rows Removed by Filter 262→0 and 261→0, cost 229.75→185. 4b/4d unchanged. Section 5 plans identical; the two #4331 COALESCE indexes still demoted to Filter on 18 (issue #4341 confirmed with production data) |
| Trigram reindex duration (7 indexes)  | **Dry run only** — 7 discovered, libc reported, correct CONCURRENTLY statements. Not required (`datlocprovider = c`) so `--confirm` skipped. First real-world validation of the tool against Azure 18.6                                                                                                                                         |
| `rls-all-tables` result               | **PASS against the rehearsal server.** Target confirmed via the guard error naming `accounter_admin@$RESTORED_HOST…`, and `dotenv` proven not to override inline env                                                                                                                                                                            |
| pgTyped hash matched                  | **PASS — no PG18 drift.** Prod schema on 16 and 18 both give `a5de15bc…`; migration-built schema on both gives `841666e6…`. The initial mismatch was schema drift, not version                                                                                                                                                                  |
| UI free-text search                   | **PASS**                                                                                                                                                                                                                                                                                                                                        |
| Scrape-ingestion batch                | **PASS**                                                                                                                                                                                                                                                                                                                                        |
| Rehearsal server deleted              | pending — do it now                                                                                                                                                                                                                                                                                                                             |

Fill this in **before** deleting the server — several rows are unrecoverable afterwards.
