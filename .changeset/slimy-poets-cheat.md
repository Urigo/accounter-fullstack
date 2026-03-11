---
'@accounter/server': patch
---

- **API Key Authentication Implementation**: Implemented the core logic for API key authentication
  within the `AuthContextProvider`, allowing the system to validate API keys against a database,
  check for revocation, and establish an authentication context.
- **API Key Usage Tracking**: Introduced a mechanism to track API key usage by updating a
  `last_used_at` timestamp in the database, with a built-in hourly throttling to reduce write
  amplification.
