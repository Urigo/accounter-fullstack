---
'@accounter/client': patch
---

Give the client a CI safety net: run its tests and its Storybook on every client PR.

Client-only pull requests previously ran lint, Prettier and GraphQL validation and nothing else.
`server-tests.yml` is the only workflow invoking vitest and its `paths` filter covers just
`packages/server`, `packages/migrations` and `packages/email-ingestion-gateway`; `pr.yml`'s
`compile` job runs for forked PRs only. So the client's 44 test files were exercised only when an
unrelated server PR happened to trigger that workflow, or after merge to `main` — and
`storybook:build` never ran in CI at all, leaving a broken story to be caught by `tsc` on `main`.

Running client tests on their own was also impossible: `scripts/vitest-global-setup.ts` calls
`assertLocalDatabase()` and connects to Postgres, and it was declared on every vitest project
including `unit`, so a pure client test still required a database.

- New `client` vitest project that declares no `globalSetup`, so it runs with no Postgres, and sets
  `environment: 'happy-dom'` at the project level (the ~27 per-file `@vitest-environment` pragmas
  are now redundant and can be dropped separately). The root-level `globalSetup` is removed — it
  applied to every project; each database-backed project (`unit`, `integration`, `demo-seed`)
  already declared it individually. `packages/client/**` is excluded from `unit` so its tests do
  not run twice, and `yarn test` / `test:integration` now name `--project client` explicitly so
  nothing loses coverage. Added `yarn test:client`.
- `.storybook/` is now typechecked and linted. It was excluded from `packages/client/tsconfig.json`'s
  `include` and matched `'**/.storybook/'` in the ESLint ignore list, so the config the stories
  depend on was covered by neither. (TypeScript's wildcard include does not descend into
  dot-directories by name alone, hence the explicit `.storybook/**/*` glob.)
- `src/__tests__/stories.test.tsx` mounts every story via portable stories (`composeStories`), so a
  story that stops compiling or throws on render now fails CI. Storybook's own
  `@storybook/addon-vitest` would normally cover this in a real browser with a11y assertions, but as
  of 10.6.0 it peer-requires vitest `^3 || ^4` and this repo is on vitest 5; revisit when it
  supports 5.
- Added `@storybook/addon-a11y` for the accessibility panel, and moved the `MantineProvider`, urql,
  `UserContext` and router wrappers out of individual stories into `.storybook/preview.tsx`. Stories
  needing a specific route set `parameters.router.initialEntries` — react-router throws on a nested
  `<Router>`, which the new story test caught immediately.

The matching `client-tests.yml` workflow — which would run these on every PR touching
`packages/client/**` — is not included here: pushing `.github/workflows/**` needs a GitHub token
with `workflow` scope. Until it is added, the client tests run through `yarn test` and
`yarn test:integration` rather than on a client-path trigger.
