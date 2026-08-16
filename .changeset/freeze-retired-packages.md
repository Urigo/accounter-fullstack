---
---

Freeze three retired packages: `@accounter/green-invoice-graphql`, `@accounter-helper/old-accounter`
and `@accounter-helper/scraper-local-app`. They keep their source in the repo but stop generating
maintenance traffic — no dependency upgrades, no monorepo build participation, no publishing.

- **Renovate** is disabled for all three via a trailing `packageRules` entry in `renovate.json`
  matching their manifests. The rule is last on purpose: rules are applied in order and it has to
  win over the broad `devDependencies` and patch-group rules above it.
- **Build**: `scraper-local-app` is removed from the root `build:main` (it was already excluded from
  `build:tools`), so `yarn build` no longer builds it — run
  `yarn workspace @accounter-helper/scraper-local-app build` directly for a rollback.
  `green-invoice-graphql`'s `build` is reduced to `yarn generate` (GraphQL-Mesh codegen only); the
  `bob build` bundle, the `bob-the-bundler` dependency, the `dist` entry-point fields and the
  `start`/`test`/`prepublish` scripts that pointed at `dist/` are gone. The codegen must stay in the
  build because `@accounter/server` compiles green-invoice **from source** (`paths`/`include` in
  `packages/server/tsconfig.json`) and its mesh artifacts are git-ignored.
- **Publishing**: `green-invoice-graphql` is now `private` with no `publishConfig`, so it is no
  longer released to npm; `0.8.6` remains the last published version. Changesets gets
  `privatePackages: { version: false, tag: false }` so its version stays pinned there, which keeps
  the `^0.8.6` range in the published `@accounter/server` manifest resolvable. Stale auto-generated
  `@accounter_green-invoice-graphql-*-dependencies` changesets are removed.
- Frozen status is documented in each package README, in the package descriptions, and in a new
  "Frozen packages" section in the root `CLAUDE.md`. Also fixed a stray merge-conflict marker in
  that file and a stale `old-accounter` path in `.vscode/launch.json`.

No published-package version bumps: the two `@accounter-helper/*` packages are ignored by changesets
and `green-invoice-graphql` is now private, so this is a tooling and documentation change only.
