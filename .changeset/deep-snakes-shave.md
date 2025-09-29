---
'@accounter/server': patch
---

- **Enhanced Business Suggestion Data**: The `suggestionData` structure for businesses has been
  extended to include new fields: `emails`, `internalEmailLinks`, and `priority`, allowing for more
  comprehensive business suggestions.
- **Introduced Zod for Data Validation**: A new Zod schema (`suggestionDataSchema`) has been
  implemented to provide robust runtime validation for `suggestionData`. This replaces previous type
  assertions, ensuring data integrity and consistency across the application.
- **Refactored Suggestion Handling Logic**: The `updateSuggestions` helper function and various
  resolvers have been updated to correctly process, merge, and validate the new `suggestionData`
  fields using the Zod schema, improving reliability and error handling.
- **GraphQL Schema Update**: The GraphQL types `Suggestion` and `SuggestionInput` have been modified
  to reflect the newly added `emails`, `internalEmailLinks`, and `priority` fields, making them
  available through the API.
