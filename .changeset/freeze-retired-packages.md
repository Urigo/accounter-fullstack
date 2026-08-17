---
---

Freeze three retired packages: `@accounter/gmail-listener`, `@accounter-helper/old-accounter` and
`@accounter-helper/scraper-local-app`. They keep their source in the repo but stop generating
maintenance traffic — no dependency upgrades, no monorepo build participation, no publishing.

- **Renovate** is disabled for all three via a trailing `packageRules` entry in `renovate.json`
  matching their manifests, plus `packages/gmail-listener/DockerFile` so its base image stops being
  bumped too. The rule is last on purpose: rules are applied in order and it has to win over the
  broad `devDependencies` and patch-group rules above it.
- **Build**: `gmail-listener` is excluded from the root `build:tools`, and `scraper-local-app` is
  removed from `build:main` (it was already excluded from `build:tools`), so `yarn build` no longer
  builds either. Build them directly — `yarn workspace <name> build` — if a rollback needs them.
  `gmail-listener` is still covered by root `yarn generate`, which keeps its GraphQL client under
  `src/gql/` in sync so the package stays typecheckable.
- **Publishing**: `gmail-listener` is now `private` with no `publishConfig` and no `prepublishOnly`,
  so it is no longer released to npm; `0.1.2` remains the last published version. Changesets gets
  `privatePackages: { version: false, tag: false }` so its version stays pinned there. Nothing in
  the workspace depends on it, so no dependency range is affected. Stale auto-generated
  `@accounter_gmail-listener-*-dependencies` changesets are removed.
- Frozen status is documented in each package README (`old-accounter` gains one) and in a new
  "Frozen packages" section in the root `CLAUDE.md`. Also fixed a stray merge-conflict marker in
  that file and a stale `old-accounter` path in `.vscode/launch.json`.

No published-package version bumps: the two `@accounter-helper/*` packages are ignored by changesets
and `gmail-listener` is now private, so this is a tooling and documentation change only.
