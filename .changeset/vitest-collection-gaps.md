---
---

Close the remaining gaps in how vitest collects tests and in the database guard's messages. Test
tooling and docs only; no release.

- The `unit` project's include is anchored at `packages/` and `scripts/`, so a second checkout of
  the repo elsewhere inside the repo folder contributes no tests at all, not only one under
  `.claude/`. One placed under `packages/` or `scripts/` still contributes its plain unit tests,
  never its database-backed ones.
- The demo-seed migration check opens no connection when the suite is going to be skipped, and a
  database that cannot be reached is reported instead of thrown, so a run with no database up is not
  stopped by it.
- The demo-seed project's migration check (`scripts/vitest-demo-seed-setup.ts`) is registered as a
  `globalSetup` module. It was listed under `setupFiles`, where vitest only imports the file, so its
  `setup()` never ran and a stale schema surfaced as an unrelated seed error.
- Three unit tests under `packages/server/src/demo-fixtures/` that no project collected now run in
  the `unit` project. The demo seed test itself stays in `demo-seed` only.
- The local-database guard's messages suggest `grep -E '^POSTGRES_(HOST|PORT|DB|USER)=' .env`
  instead of `grep '^POSTGRES' .env`, which also printed `POSTGRES_PASSWORD`.
