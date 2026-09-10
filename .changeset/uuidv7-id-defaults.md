---
'@accounter/server': patch
---

Switch every `DEFAULT gen_random_uuid()` column in `accounter_schema` to PostgreSQL 18's `uuidv7()`.

`gen_random_uuid()` produces v4 uuids — uniformly random, so consecutive inserts land in unrelated
pages of the primary-key B-tree. Every insert is a candidate page split, the effective working set is
the whole index rather than its right-hand edge, and the resulting page dirtying shows up as extra
full-page images in WAL. `uuidv7()` puts a millisecond timestamp in the high 48 bits, so ids sort by
creation time and inserts append instead of scattering. The tables where that matters are the
append-heavy ones: `charges`, `transactions`, `documents`, `ledger_records`, and every scraper raw
table.

`2026-09-09T10-00-00.uuidv7-id-defaults.sql` is the whole change. Id generation for these tables is
entirely a DB-side `DEFAULT` — no server code calls `gen_random_uuid()` — so altering the default is
sufficient, and altering a default rewrites one `pg_attrdef` row per column without touching a single
heap page. There is no backfill and no rewrite: existing v4 ids stay exactly as they are, and a
column holding a mix of v4 and v7 values is well-formed, since both are 128-bit uuids compared and
indexed byte-wise and nothing in the schema or the application reads a version nibble out of an id.

The target columns — the `id` of each table, plus `business_users.user_id` — are discovered from
`pg_attrdef` rather than listed in the migration, so it converts whatever the target database
actually holds. An environment that is behind on migrations, or a table added between this being
written and being deployed, converts the same way, and re-running finds nothing left to do. Running
the full migration set into an empty database puts the count at 49 (the issue's audit says 50, which
is why the exact number is deliberately not written into the migration). A guard raises a clear error
on a server older than 18 instead of letting the first `ALTER` fail with a bare "function uuidv7()
does not exist".

Three sites are deliberately excluded. `shared/helpers/deterministic-uuid.ts` (uuid v5), used by
`entity-ensure.provider.ts`, stays as it is: its determinism *is* the idempotency mechanism behind
`ON CONFLICT (id) DO NOTHING` during ingestion, and a time-ordered id would re-insert every row on
every run. The app-side `randomUUID()` callers in `auth/providers/invitations.provider.ts`,
`email-ingestion-control.provider.ts` (`jti`) and `email-ingestion-ingest.provider.ts` are low volume
and, being app-side, out of reach of a column default anyway. Neither category is affected by this
migration even in principle.

The trade-off, stated rather than assumed: a v7 id is no longer opaque about when its row was
created — the leading 48 bits are a readable Unix millisecond timestamp — ids become roughly ordered,
and a neighbouring id becomes guessable in a way a v4 id is not. That is acceptable here because none
of these columns is a secret: every one of these tables already carries a `created_at`, access is
gated by authentication and RLS rather than id unguessability, and the actual capability tokens are
separate `TEXT` columns filled from `node:crypto` (`invitations.token`, `api_keys.key_hash`,
`email_ingestion_replay_nonces.nonce`). A future column that needs an unguessable id should declare
`DEFAULT gen_random_uuid()` explicitly and be added to the exemption set in the new test.

`uuidv7-id-defaults.test.ts` runs the full migration set into a fresh database and asserts the
catalog invariant — no uuid column in `accounter_schema` is left on `gen_random_uuid()` outside a
named exemption set (empty today) — so a future table that ships with the v4 default is caught as it
lands rather than by someone re-running the audit. It also names the four append-heavy tables and
`business_users.user_id` explicitly, decodes the timestamp out of a freshly generated id to prove the
default really is time-ordered, and inserts an explicit v4 id to pin down the coexistence the "no
backfill" claim rests on.

Verified locally by running the full migration set into an empty database and exercising the catalog
loop against it: 49 columns converted, a second run converts 0, and the documented revert — the same
loop with the two function names swapped — puts all 49 back. The version guard was confirmed to fire
with its own message rather than a missing-function error. That run was on PostgreSQL 16 with a
stand-in `uuidv7()`, so the v7-shaped assertions in the new test are exercised by CI, which runs
`postgres:18-alpine`.

The database is ~100 MB today and the benefit scales with insert volume and index size, so this is a
"do it before it hurts" change rather than a fix for a measured regression.
