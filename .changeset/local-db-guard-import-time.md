---
'@accounter/server': patch
---

Fix the local-DB guard breaking deploys: check on connect, not on import.

`test-db-config.ts` asserted at module scope, but it also exports `qualifyTable`, a pure
string helper. `scripts/seed-demo-data.ts` reaches that helper transitively
(seed-demo-data -> fixture-loader -> test-db-config), so importing a string function aborted
a staging deploy with `Refusing to run the test harness against a non-local database` while
seeding. Importing a utility is not evidence that anyone is about to run tests; connecting
is.

The assert is now an exported `assertTestDatabaseIsLocal()` called from the two places that
actually open a connection — `connectTestDb()` and `runMigrationsIfNeeded()` — so protection
for the test harness is unchanged while importing the module is always safe.

Also switches `scripts/seed-demo-data.ts` from refuse to warn. That script runs inside the
staging deploy's build command against a deployed database, so a deployed target is its
intended use. Requiring an opt-in variable there means every new staging or preview
environment fails its first deploy on a safety check. The protection against seeding the
wrong database remains the `ALLOW_DEMO_SEED` gate plus a visible target in the build log.

The principle: refuse where a deployed database is never legitimate (tests, `seed:production`);
warn where it is (`migration:run`, `seed:staging-demo`, both of which run during deploys).
