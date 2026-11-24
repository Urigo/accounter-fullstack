---
'@accounter/server': patch
---

Close what a test run and the demo seed could still reach after the first database guards.

- **Collection.** Vitest no longer collects anything under `.claude/`, and the `unit` project's
  excludes now match at any depth. A git worktree is a second copy of the repo inside the repo
  folder, and a plain `yarn test` in the main checkout collected its test files and ran them against
  that checkout's database. A copy from a branch that predates the guards still carries a demo seed
  test that opts itself in. The server package's own `vitest.config.ts`, which a run started inside
  `packages/server` uses, no longer collects the demo seed test either.
- **The demo seed** (`yarn seed:staging-demo`) now also refuses a database that is not a demo
  database, by its name, on a local host as well as a remote one. `ALLOW_DEMO_SEED=1` and
  `ALLOW_REMOTE_DB=1` say that the seed may run and may leave the machine. Neither says which
  database it is, and a staging build command carries both. A name carrying `prod`, `production`,
  `prd` or `live` is refused and nothing overrides it. A name carrying `staging`, `stage`, `demo`,
  `test`, `testing`, `preview`, `sandbox`, `e2e` or `local` is accepted, and so is the dev
  container's `accounter` on a local host. Any other database, a local copy of production included,
  has to be confirmed with the new `ALLOW_DEMO_SEED_DATABASE=<exact database name>`, which is
  refused in a `.env` file like the other two opt-ins. The rule is checked before connecting and
  again against the name the server reports, right before the `TRUNCATE`.
- **The demo seed test** (`yarn test:demo-seed`) checks its target itself before it starts the seed,
  and refuses any database that is not local with no override, instead of relying on the seed script
  to refuse.
- **A refusal from the demo seed** is printed once, as a message. It used to be printed three times,
  two of them with a stack trace, under "Fatal seed error".

Staging deploys are unaffected: `ALLOW_REMOTE_DB=1 ALLOW_DEMO_SEED=1 yarn seed:staging-demo` against
`accounter_staging_db` (or the guide's `accounter_staging`) passes on the name. A demo environment
whose database name carries none of the accepted words will fail its seed step until it is renamed
or `ALLOW_DEMO_SEED_DATABASE` is added to its build command.

The root `README.md` and `.env.template` now say outright that the root `.env` must never hold
production credentials, and list every guard in one place.
