---
'@accounter/server': patch
---

- **New Demo Staging Dataset System**: Introduced a comprehensive system for seeding rich,
  deterministic financial data for staging and development environments, based on predefined
  use-cases.
- **Comprehensive Ledger Validation**: Implemented a robust validation layer
  (`packages/server/src/demo-fixtures/validators/`) that performs per-record, aggregate, and
  entity-level balance checks, along with data integrity, foreign currency, and date validations.
- **Use-Case Driven Data Seeding**: The system now uses a registry of self-contained financial
  scenarios (`packages/server/src/demo-fixtures/use-cases/`) that can be seeded with a single
  command, ensuring stable entity IDs across deployments using deterministic UUIDs.
- **New NPM Scripts and Test Suite**: Added new `package.json` scripts (`seed:staging-demo`,
  `validate:demo`, `test:demo-seed`) and a dedicated Vitest project (`demo-seed`) for end-to-end
  testing of the seeding and validation pipeline.
- **Refactored Seed Helpers**: Centralized and improved helpers for idempotent creation of financial
  entities, businesses, and tax categories, along with new helpers for seeding exchange rates and
  VAT defaults.
- **Extensive Documentation**: New documentation files (`docs/demo-staging-dataset-spec.md`,
  `docs/demo-staging-dataset-prompt-plan.md`, `docs/demo-staging-dataset-todo.md`,
  `packages/server/docs/demo-staging-guide.md`) provide detailed specifications, implementation
  plans, and developer guides.
