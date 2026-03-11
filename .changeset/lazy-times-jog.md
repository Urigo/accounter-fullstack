---
'@accounter/server': patch
---

- **API Key Generation Mutation**: Introduced a new GraphQL mutation `generateApiKey` allowing
  `business_owner` roles to create API keys.
- **Secure Key Storage**: Implemented a mechanism to store SHA-256 hashes of API keys in the
  database, ensuring plaintext keys are never persisted.
- **Role-Based Access Control**: Enforced that API keys can only be assigned the `scraper` role and
  explicitly rejects assigning higher-privilege roles such as `business_owner` for security.