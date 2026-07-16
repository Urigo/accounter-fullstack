# Operations Docs

## Migration Conflict Guard

A PR check named Migration conflicts prevents silent DB function overrides across migrations.

It detects:

- Parallel PRs that touch the same function (for example create or replace function on the same
  object)
- Rebased PRs that still override functions already present on the base branch
- PRs that edit existing migration files instead of adding new ones

Local run:

- yarn migration:check-conflicts

Intentional override flow:

- Add a comment in the PR migration file:
  - migration-conflict-allow: accounter_schema.function_name because reason

Rollout mode:

- Set MIGRATION_CONFLICT_WARN_ONLY=1 to report conflicts without failing the check
