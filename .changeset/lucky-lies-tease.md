---
'@accounter/server': patch
---

- **Intent**: This pull request aims to enhance the backend's business suggestions by introducing a
  new `emailListener` configuration. This allows for more detailed control over how emails related
  to a business are processed, including specifying internal email links, whether to process the
  email body, and which attachment types (PDF, PNG, JPEG) to consider.
- **Key Changes**: The core changes involve refactoring the `suggestionDataSchema` from
  `modules/documents` to `modules/financial-entities`, extending this schema to include a new
  `emailListener` field, and updating the GraphQL API to expose these new types. Business logic for
  merging and handling `emailListener` configurations during updates has been implemented.
  Additionally, a new `getBusinessByEmail` method was added to retrieve businesses based on emails
  in their suggestion data, along with enhanced cache invalidation for business data.
- **Affected Files**: The changes span across multiple files:

* `eslint.config.mjs`: Updated to recognize the new `SuggestionsEmailListenerConfig`.
* `packages/server/src/modules/charges/resolvers/charge-suggestions/charge-suggestions.resolver.ts`:
  Updated import path for `suggestionDataSchema`.
* `packages/server/src/modules/documents/helpers/suggestion-data-schema.helper.ts`: Removed.
* `packages/server/src/modules/documents/types.ts`: Removed `SuggestionData` export.
* `packages/server/src/modules/financial-entities/helpers/business-suggestion-data-schema.helper.ts`:
  Added, defining `suggestionDataSchema` with `emailListener` and `EmailListenerConfig`.
* `packages/server/src/modules/financial-entities/helpers/businesses.helper.ts`: Modified to handle
  `emailListener` merging logic and updated suggestion field merging.
* `packages/server/src/modules/financial-entities/providers/businesses.provider.ts`: Added
  `getBusinessByEmail` query and method, renamed `insertBusinessesLoader`, and enhanced cache
  invalidation for business emails.
* `packages/server/src/modules/financial-entities/resolvers/businesses.resolver.ts`: Updated to use
  the new `emailListener` field in mutations and resolvers, and adjusted DataLoader usage.
* `packages/server/src/modules/financial-entities/typeDefs/businesses.graphql.ts`: Modified GraphQL
  schema to include `SuggestionsEmailListenerConfig`, `EmailAttachmentType` enum, and updated
  `Suggestion` and `SuggestionInput` types.
* `packages/server/src/modules/financial-entities/types.ts`: Exported new `SuggestionData` and
  `EmailListenerConfig` types.
* `packages/server/src/modules/transactions/resolvers/transaction-suggestions.resolver.ts`: Updated
  import path for `suggestionDataSchema`.
