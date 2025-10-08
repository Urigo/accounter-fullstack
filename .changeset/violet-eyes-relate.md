---
'@accounter/server': patch
---

1.  **Environment Variable Validation**: The `HIVE_TOKEN` and `DEEL_TOKEN` environment variables are
    now marked as mandatory (`zod.string()` instead of `zod.string().optional()`) within their
    respective Zod schemas in `packages/server/src/environment.ts`.
2.  **Model Renaming**: The `GoogleModel` has been renamed to `GoogleDriveModel` in
    `packages/server/src/environment.ts`, and all references to it in `configs` and `env` exports
    have been updated accordingly.
3.  **Conditional Configuration Export**: The `env` export in `packages/server/src/environment.ts`
    now conditionally defines the nested configuration objects for `greenInvoice`, `hive`,
    `googleDrive`, and `deel`. If the corresponding environment variables are not present, these
    top-level objects will be `undefined`.
4.  **Safe Access to Environment Variables**: Throughout the application, specifically in
    `packages/server/src/index.ts`,
    `packages/server/src/modules/app-providers/deel/deel-client.provider.ts`,
    `packages/server/src/modules/app-providers/google-drive/google-drive.provider.ts`, and
    `packages/server/src/modules/app-providers/green-invoice-client.ts`, the access patterns for
    these environment variables have been updated to use optional chaining (`?.`) to safely handle
    cases where the configuration might be `undefined`.
