---
'@accounter/server': patch
---

- **New Authentication Plugin (Auth Plugin V2)**: Introduced a new GraphQL Yoga plugin,
  `authPluginV2`, responsible for extracting raw authentication credentials (JWT or API Key) from
  request headers. This plugin is designed to be part of the v2 authentication system, specifically
  for Auth0 integration, and focuses solely on credential extraction without verification.
- **Environment Variable for Auth0 Control**: Added a new environment variable, `USE_AUTH0`, to the
  server's configuration. This variable allows for toggling the use of Auth0, indicating a phased
  rollout or conditional activation of the new authentication system.
- **Support for JWT and API Key Extraction**: The new plugin can extract JWTs from the
  `Authorization: Bearer` header and API keys from the `X-API-Key` header, with JWT taking
  precedence when both are present. It also handles cases of missing or malformed headers
  gracefully.
- **Comprehensive Unit Tests**: A dedicated test file (`auth-plugin-v2.test.ts`) has been added to
  thoroughly test the functionality of the `authPluginV2`, covering various scenarios including
  token extraction, header precedence, and error handling for malformed inputs.
