---
---

Deprecate the legacy `@accounter-helper/scraper-local-app` CLI scrape runner now that
`@accounter/scraper-app` (a local Fastify server + React UI web app) covers the same scraping
workflow.

- `@accounter-helper/scraper-local-app` is marked deprecated (README banner + package description)
  and superseded by `@accounter/scraper-app`. It is kept only for rollback until `scraper-app` is
  fully in production use, and receives no new features.
- Docs updated to reflect the migration (root `README.md`, root `CLAUDE.md`,
  `docs/claude-code-setup/spec.md`).

No published-package version bumps: `scraper-local-app` is private and ignored by changesets, and the
change is documentation-only. Hard removal of `scraper-local-app` from the monorepo is a follow-up
once the `scraper-app` cutover is complete (see `docs/architecture/scraper-app-refactor/plan.md`).
