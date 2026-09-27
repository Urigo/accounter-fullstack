---
---

Retire the `@accounter/hashavshevet-mesh` and `@accounter/payper-mesh` packages. Nothing in the monorepo
imported them and they had no functional changes since 2024, so they are removed instead of being
migrated to GraphQL Mesh v1. Their pending dependency-bump changesets are dropped with them. The
published npm versions stay available and should be marked deprecated by a package owner.
