---
'@accounter/modern-poalim-scraper': patch
---

- **Schema Migration**: The project has been migrated from using AJV (JSON Schema) for data
  validation to Zod, a TypeScript-first schema declaration and validation library.
- **Dependency Removal**: The `ajv` and `ajv-formats` packages have been removed from the project
  dependencies, streamlining the validation stack.
- **Schema File Refactoring**: All `.json` schema definition files have been removed and replaced
  with new `.ts` files defining Zod schemas, improving type safety and developer experience.
- **Validation Logic Update**: Scraper modules now utilize Zod's `safeParse` method for data
  validation, replacing the previous `validateSchema` utility.
- **Centralized Type Exports**: A new `types.ts` file has been introduced within the `zod-schemas`
  directory to centralize the export of all Zod-generated types, simplifying type imports across the
  application.
