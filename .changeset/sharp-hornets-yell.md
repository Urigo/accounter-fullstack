---
'@accounter/server': patch
---

- **Alias Removal**: Custom path aliases like `@modules/*` and `@shared/*` have been removed from
  the `tsconfig.json` and `vitest.config.ts` configuration files.
- **Import Path Updates**: All affected TypeScript files across the `packages/server/src` directory
  have been updated to use explicit relative import paths instead of the previously configured
  aliases. This includes imports for GraphQL types, shared types, enums, constants, and
  module-specific files.
- **Improved Module Resolution**: The change promotes more explicit and self-contained module
  dependencies, which can simplify module resolution and enhance code readability and
  maintainability.
