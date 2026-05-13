---
'@accounter/server': patch
---

Add per-tenant provider credentials system with encrypted storage. Includes a new `provider_credentials` database table, AES-256-GCM encryption helpers, payload schemas for credential types, a `ProviderCredentialsProvider` with full CRUD operations, and a GraphQL module exposing queries and mutations for managing provider credentials per tenant.
