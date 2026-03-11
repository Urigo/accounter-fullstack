---
'@accounter/server': patch
---

- **API Key Management Mutations**: New GraphQL mutations `generateApiKey` and `revokeApiKey` have
  been introduced to allow business owners to manage API keys, including creating new keys with
  specific roles and revoking existing ones.
- **API Key Listing Query**: A new GraphQL query `listApiKeys` is now available, enabling business
  owners to view all active API keys associated with their business.
