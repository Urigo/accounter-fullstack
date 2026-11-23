---
'@accounter/server': patch
---

Stop a test run from being able to wipe a deployed database.

With a root `.env` that pointed at a deployed database, a plain `yarn test` could end in a
`TRUNCATE` of that database's domain tables. The `unit` vitest project collected the copy of
`demo-fixtures/__tests__/seed-and-validate.test.ts` that a git worktree keeps under
`.claude/worktrees/`, that test passed `ALLOW_DEMO_SEED=1` to `scripts/seed-demo-data.ts`, and the
script only warned about a non-local target before its `TRUNCATE`.

- **Collection.** Vitest no longer collects anything under `.claude/`, and the `unit` project's
  excludes now match at any depth, so a second checkout anywhere inside the repo cannot contribute
  its database-backed or demo seed tests. The server package's own `vitest.config.ts`, which a run
  started inside `packages/server` uses, no longer collects the demo seed test either.
- **The vitest global setup** now stops the run when the root `.env` points at a non-local database.
  It used to check only variables already in the environment, before anything had read `.env`, so
  that case was logged as a warning and every test still ran. A local database that is not running
  is still only a warning.
- **The demo seed test** (`yarn test:demo-seed`) refuses any database that is not local, with no
  override, and no longer sets `ALLOW_DEMO_SEED=1` itself: it has to be on the command, as the
  README already said.
- **The demo seed** (`yarn seed:staging-demo`) refuses to reset a database that is not a demo
  database, on a local host as well as a remote one. A name carrying `prod`, `production`, `prd` or
  `live` is refused and nothing overrides it. A name carrying `staging`, `stage`, `demo`, `test`,
  `testing`, `preview`, `sandbox`, `e2e` or `local` is accepted, and so is the dev container's
  `accounter` on a local host. Any other database, a local copy of production included, has to be
  confirmed with the new `ALLOW_DEMO_SEED_DATABASE=<exact database name>`. The rule is checked
  before connecting and again against the name the server reports, right before the `TRUNCATE`.
  `ALLOW_REMOTE_DB=1` does not unlock it.

Staging deploys are unaffected: `ALLOW_DEMO_SEED=1 yarn seed:staging-demo` against
`accounter_staging_db` (or the guide's `accounter_staging`) passes on the name, with no new
variable. A demo environment whose database name carries none of the accepted words will fail its
seed step until it is renamed or `ALLOW_DEMO_SEED_DATABASE` is set in its deploy settings.

The root `README.md` and `.env.template` now say outright that the root `.env` must never hold
production credentials, and document `ENFORCE_LOCAL_DB=1`.
