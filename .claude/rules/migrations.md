---
paths:
  - 'packages/migrations/**'
---

# Migration Conventions

- Migration files go in `packages/migrations/src/`.
- SQL migrations must be idempotent where possible.
- Always include both up and down migrations.
- Never modify an existing migration that has been deployed.
- Test migrations locally with `yarn local:setup` before committing.
