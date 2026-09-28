---
---

Deprecate `@accounter/hashavshevet-mesh` and `@accounter/payper-mesh`. Nothing in the monorepo imports
them, so instead of being migrated to GraphQL Mesh v1 they are kept as frozen, detached packages:
excluded from the Yarn workspaces (so their GraphQL Mesh v0 dependencies leave the root lockfile),
from the build, from linting and formatting, and from Renovate. Each now declares its own build
tooling and can still be built standalone. Their pending dependency-bump changesets are dropped,
since packages outside the workspaces can't be versioned by changesets; the published npm versions
stay available and should be marked deprecated by a package owner.
