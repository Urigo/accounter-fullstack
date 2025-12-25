---
'@accounter/server': patch
---

- **Anthropic API Migration**: The Anthropic API calls have been refactored to align with the new
  `ai` SDK, specifically migrating from the `generateObject` function to `generateText` with an
  `Output.object` configuration for structured responses.
- **Model Name Update**: The Anthropic model name used in the `AnthropicProvider` has been updated
  from `claude-4-sonnet-20250514` to `claude-sonnet-4-5`.
