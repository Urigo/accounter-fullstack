---
'@accounter/green-invoice-graphql': patch
'@accounter/server': patch
---

* **New Charges Auto-Matcher Module**: A new GraphQL module `charges-matcher` has been introduced, complete with its directory structure, TypeScript types, and GraphQL schema definitions for single-match and auto-match functionalities.
* **Comprehensive Documentation**: Detailed `SPEC.md`, `PROMPT_PLAN.md`, and `TODO.md` documents have been added, outlining the technical specification, a 17-step implementation plan, and a checklist for the transaction-document matching system.
* **Core Matching Logic Implemented**: Helper functions for calculating confidence scores based on amount, currency, business ID, and date proximity have been implemented and thoroughly tested.
* **Data Aggregation Providers**: Providers for aggregating multiple transactions and documents into single representations, including filtering, currency/business ID validation, and description concatenation, are now in place.
* **Single-Match & Auto-Match Core Functions**: The core logic for finding single matches (with date window filtering and tie-breaking) and for processing charges for auto-matching (including merge direction determination and high-confidence thresholding) has been developed.
* **Robust Testing Infrastructure**: A comprehensive testing framework, including mock factories and 494 passing unit and integration tests, has been established, ensuring high code coverage.
* **GraphQL Integration**: GraphQL resolvers for `findChargeMatches` and `autoMatchCharges` mutations/queries have been added, and the module is registered in the main GraphQL application.
* **Type Safety Improvement**: The `amount` type in the `DocumentSuggestionsProto` interface has been updated from `string` to `number` for enhanced type safety.
