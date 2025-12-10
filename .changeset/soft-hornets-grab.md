---
'@accounter/server': patch
---

- **Centralized UUID Generation**: The deterministic UUID generation logic has been centralized into
  a new file, `packages/server/src/demo-fixtures/helpers/deterministic-uuid.ts`, replacing the
  previous `packages/server/src/__tests__/factories/ids.ts`.
- **UUID v5 Implementation**: The new `makeUUID` function now generates UUID v5, which is
  specifically designed for deterministic UUIDs based on a namespace and a name. This ensures stable
  and reproducible IDs across environments.
- **Structured ID Generation**: The `makeUUID` function now requires two arguments: a `namespace`
  (e.g., 'business', 'charge') and a `name` (a semantic identifier). This provides better
  organization and prevents ID collisions between different entity types.
- **Backward Compatibility**: A `makeUUIDLegacy` function has been introduced to maintain
  compatibility with older calls that used a single seed or generated random UUIDs when no seed was
  provided.
- **Codebase Migration**: All existing calls to `makeUUID` across various factory files, test files,
  and fixture definitions have been updated to use the new centralized `makeUUID` or
  `makeUUIDLegacy` functions with appropriate namespaces.
- **Improved Test Fixture Stability**: This change enhances the stability and reproducibility of
  test fixtures and demo data, making it easier to reference specific entities in documentation and
  external links without fear of IDs changing.
