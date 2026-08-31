---
'@accounter/server': patch
---

Refuse to run dev tooling against a non-local database by default.

The repo root `.env` is shared by codegen, migrations, seeds and every DB-backed test, so a
command that looks local is only as local as that file currently is — and it has historically
defaulted to a deployed host. `scripts/vitest-global-setup.ts` runs before *every* vitest
project (`--project unit` included) and writes reference data, and
`packages/migrations/src/__tests__/rls-all-tables.test.ts` issues `CREATE DATABASE` and runs
every migration into it.

New `packages/migrations/src/local-db-guard.ts` centralises the check. The test harness
(`test-db-config.ts`, which every DB-backed helper builds its pool from), the vitest global
setup, the RLS suite and both seed scripts now **refuse** a non-local host unless
`ALLOW_REMOTE_DB=1` is set for that command. `migration:run` **warns** loudly instead of
failing, because production deploys may apply migrations during the build and that path is
unconfirmed; set `ENFORCE_LOCAL_DB=1` to make it strict locally.
