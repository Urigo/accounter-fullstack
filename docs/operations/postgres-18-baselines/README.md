# Postgres 16 → 18 upgrade baselines

Before/after evidence for the major version upgrade. See `docs/operations/postgres-18-upgrade.md`
for the procedure these files support.

The point of everything here is **paired** captures: a fact recorded on 16 and the same fact
recorded on 18. A capture with no counterpart proves nothing, and after the upgrade the 16 side can
never be obtained again.

## Contents

| File                          | What it is                                                       | Committed              |
| ----------------------------- | ---------------------------------------------------------------- | ---------------------- |
| `pre-upgrade-catalog.psql`    | Catalog snapshot script. Metadata only, re-runnable              | yes                    |
| `capture-plans.psql`          | Plan capture script (dedup + date-range queries)                 | yes                    |
| `rehearsal-command-sheet.md`  | The 11-step rehearsal procedure, as executed                     | yes                    |
| `16-catalog-snapshot.txt`     | Production catalog **before** the upgrade (2026-08-31, PG 16.14) | yes — no customer data |
| `PROD18-catalog-snapshot.txt` | Production catalog **after** the upgrade (2026-09-02, PG 18.6)   | yes — no customer data |

**The raw `EXPLAIN` captures are deliberately not committed and were deleted after use.** They
contained real bank account numbers, branch numbers and security identifiers — see the redaction
rule below. Every conclusion drawn from them is recorded in the Findings section of this file and in
`../postgres-18-upgrade.md`; the raw output had no remaining value proportional to the risk.

Regenerate them any time with `capture-plans.psql` if a future comparison needs them. Note that
script's section 3 now reports **counts only** for exactly this reason: an earlier version printed
sample rows, which is how customer data ended up in a file in the first place.

## Redaction rule — read before committing any plan capture

The catalog snapshot is metadata and contains no customer data. **Query plans are different.**

An `EXPLAIN` of the free-text search contains the search term. `auto_explain` output contains query
text and can contain bound parameter values — real business names, amounts, document numbers,
counterparty names. None of that belongs in a git repository.

Before committing any `*-dedup-*` or `*-auto-explain-*` file:

1. **Drive the captures with synthetic search terms you invented.** Do not search for a real
   customer or supplier name to generate a plan.
2. **Replace UUIDs with stable placeholders** — `OWNER_A`, `OWNER_B`, `CHARGE_1`. Stable so the 16
   and 18 files stay diffable.
3. **Strip literal amounts, serial numbers, and free-text values** from the captured SQL.
4. Keep the plan _shape_: node types, index names, row estimates vs actual, loops, buffer counts.
   That is the entire basis for the comparison; literal values contribute nothing to it.

If a capture cannot be scrubbed without destroying its meaning, keep it out of the repo and store it
wherever your other production artifacts live.

## Capturing the catalog snapshot

```sh
printf 'accounter_admin password: '
read -rs PGPASSWORD
echo
docker exec -i -e PGPASSWORD="$PGPASSWORD" accounter-dev-db-1 \
  psql --host=$PROD_HOST \
  --username=accounter_admin --dbname=accounter_prod_db \
  < docs/operations/postgres-18-baselines/pre-upgrade-catalog.psql \
  > docs/operations/postgres-18-baselines/16-catalog-snapshot.txt 2>&1
unset PGPASSWORD
```

Run as `accounter_admin`, not `accounter_prod_user`: the app role has no RLS session variables set,
so `get_current_business_id()` raises and section 11's row counts would error instead of returning.

After the upgrade, re-run the identical script against the upgraded server, write
`18-catalog-snapshot.txt`, and diff:

```sh
diff -u 16-catalog-snapshot.txt 18-catalog-snapshot.txt
```

**Expected** differences: `version()`, extension versions, index sizes, row counts,
`captured_at_utc`.

**Anything else is a finding** — in particular any change to RLS coverage, `FORCE` flags, view
`reloptions`, role attributes, memberships, or function ownership.

### `datcollversion` is a finding, not an expected difference

It is tempting to wave this one through alongside `version()`. Don't. `datcollversion` is the glibc
collation version the database was built against, and if the upgrade lands the server on a different
base image it changes — which means **every index whose ordering depends on collation is potentially
mis-sorted**: all btree indexes on `text`/`varchar`, unique constraints on text columns, any string
comparison. That is a much larger job than the seven trigram indexes, and it is invisible unless you
compare these two files.

Baseline captured on production 2026-08-31: **`datcollversion = 2.38`**, `datlocprovider = 'c'`
(libc), `datcollate = en_US.utf8`.

If the 18 snapshot shows a different value, see § _1b. The collation version_ in
[`../postgres-18-upgrade.md`](../postgres-18-upgrade.md): reindex first, then
`ALTER DATABASE … REFRESH COLLATION VERSION` — never the other way round, which would hide the
problem rather than fix it.

Note this cannot be rehearsed against the local dev container: `postgres:18-alpine` uses musl and
reports no collation version at all, so `datcollversion` comes back empty there. Only a real Azure
instance — i.e. the PITR-restored rehearsal server — gives a meaningful reading.

## Findings from the 16 baseline (2026-08-31)

### 1. `CREATE INDEX CONCURRENTLY` leaves expression indexes without statistics

The first plan capture (kept as `16-plans-scope*-PRE-ANALYZE.txt`) was taken hours after #4331
deployed and shows wildly wrong estimates for the two `COALESCE` indexes — **51 estimated vs 1671
actual** and **38 vs 1162**. Expression indexes carry their own statistics, `CREATE INDEX` does not
populate them, and autoanalyze had not yet crossed its change threshold.

`ANALYZE accounter_schema.transactions; ANALYZE accounter_schema.documents;` corrected them to 1189
and 1714. The current `16-plans-scope*.txt` are post-`ANALYZE` and are the real baseline.

**Why this matters for the upgrade:** `pg_upgrade` does not preserve extended statistics, and these
expression statistics are in the same category. Skipping the post-upgrade `ANALYZE` puts production
straight back into the pre-`ANALYZE` state above. That step is load-bearing, not hygiene.

### 2. Two of #4331's four indexes cannot be used by the application at all

`idx_transactions_owner_effective_debit_date` and `idx_documents_owner_vat_report_date` are **never
chosen**. The `COALESCE(...)` predicate is demoted to a `Filter`, discarding 8,532 and 6,311 rows
per query. Note the chosen plan's cost is _identical_ for an eight-month and a one-month range
(1819.37 / 647.65 either way) — the predicate never becomes an index condition, so selectivity
cannot influence the choice.

This is **not** a statistics problem (finding 1 fixed the estimates and the plan did not change) and
**not** a matching problem (the definitions and column types match exactly — all three columns are
`date`).

**Cause: RLS.** Reproduced locally on 18.6 with an identical table, indexes and data, varying only
one thing:

| Setup                                                                  | Plan                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Superuser, `owner_id` qual written by hand                             | `Index Scan` on the **expression index**, COALESCE in `Index Cond` (cost 456)   |
| Non-superuser, `owner_id` qual injected by an RLS policy under `FORCE` | `Index Scan` on the **owner_id index**, COALESCE demoted to `Filter` (cost 741) |

Under RLS, Postgres will not evaluate a non-leakproof user qual before the security qual, so it
cannot be pushed into the index scan. `date >= const` is leakproof — which is exactly why #4331's
two _plain-column_ indexes (`idx_transactions_owner_event_date`, `idx_documents_owner_date`) work
fine. `CoalesceExpr` is treated as potentially leaky, so the whole predicate is demoted.

**The upgrade does not fix this.** The reproduction was on 18.6.

**Verified fix**, also reproduced locally: a `STORED` generated column makes the expression a plain
column, so the comparison is leakproof and indexable under RLS:

```sql
ALTER TABLE … ADD COLUMN effective_debit_date date
  GENERATED ALWAYS AS (COALESCE(debit_date_override, debit_date)) STORED;
CREATE INDEX … ON … (owner_id, effective_debit_date);
-- non-superuser under RLS then gets:
--   Index Cond: ((owner_id = ANY (...)) AND (effective_debit_date >= …) AND (… <= …))
```

`STORED` is not optional and must be written explicitly: **from PG18 on,
`GENERATED ALWAYS AS (expr)` defaults to VIRTUAL**, and virtual generated columns cannot be indexed.
Provider queries would also need to reference the new column instead of the `COALESCE`, so this is a
migration plus server change — a separate PR, not upgrade work. Until then the two indexes are pure
write overhead.

## What each section is guarding against

| §      | Guards against                                                                                                                                                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Two separate things: whether the `pg_trgm` reindex is required (`datlocprovider` ≠ `'c'` ⇒ required — production is `'c'`, so it is not), **and** a glibc collation-version change, which would require reindexing every text index. See the section above. |
| 2      | `pg_upgrade` carrying an old extension version forward                                                                                                                                                                                                      |
| 3      | An RLS gap: a table with `owner_id` and no policy is tenant data with no isolation                                                                                                                                                                          |
| 4, 6   | Azure granting the first ADMIN-option user privileges over other roles post-upgrade                                                                                                                                                                         |
| 5      | A view acquiring `security_invoker`, which would change how scope resolves                                                                                                                                                                                  |
| 7      | `get_current_business_scope()` being owned by a different role than its siblings                                                                                                                                                                            |
| 8      | A policy silently changing shape                                                                                                                                                                                                                            |
| 9      | A `CONCURRENTLY` reindex that failed part-way, leaving an index the planner ignores                                                                                                                                                                         |
| 10     | Expression indexes losing their statistics — `ANALYZE` is mandatory, not optional                                                                                                                                                                           |
| 11, 12 | Data loss, and the storage headroom the upgrade needs                                                                                                                                                                                                       |
