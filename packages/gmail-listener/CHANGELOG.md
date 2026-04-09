# @accounter/gmail-listener

## 0.1.1

### Patch Changes

- [#3247](https://github.com/Urigo/accounter-fullstack/pull/3247)
  [`43dab70`](https://github.com/Urigo/accounter-fullstack/commit/43dab70e682bd96b4e7c252a2bbda94df8f0e0ba)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`graphql@16.13.2` ↗︎](https://www.npmjs.com/package/graphql/v/16.13.2) (from
    `16.13.1`, in `dependencies`)

- [#3275](https://github.com/Urigo/accounter-fullstack/pull/3275)
  [`422938d`](https://github.com/Urigo/accounter-fullstack/commit/422938d80ef44a11e45b55c639e3238bf5d19160)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`playwright@1.59.0` ↗︎](https://www.npmjs.com/package/playwright/v/1.59.0)
    (from `1.58.2`, in `dependencies`)

- [#3246](https://github.com/Urigo/accounter-fullstack/pull/3246)
  [`cb0dbc5`](https://github.com/Urigo/accounter-fullstack/commit/cb0dbc518e8f31a0e69180d83c444658a6ca019e)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - - **Dockerfile Introduction**: A new
  Dockerfile has been added for the `gmail-listener` package, enabling its containerization using a
  Playwright base image.
  - **Docker Scripts**: Two new `yarn` scripts, `docker:build` and `docker:run`, were added to the
    `gmail-listener`'s `package.json` for convenient Docker image building and container execution.

- [#3228](https://github.com/Urigo/accounter-fullstack/pull/3228)
  [`f3842a5`](https://github.com/Urigo/accounter-fullstack/commit/f3842a597fbb02fbc08fcff8023c38d2dceaf04e)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - - **HTTP Server Integration**: An HTTP
  server was integrated into the `gmail-listener` service to expose its functionalities via a
  RESTful API.
  - **API Endpoints**: New API endpoints were added for health checks (`GET /health`), controlling
    Pub/Sub listening (`POST /start-listening`, `POST /stop-listening`), and manually triggering
    pending message handling (`POST /handle-pending-messages`).
  - **Authentication**: All new API endpoints are protected by an API key, which can be provided via
    an `Authorization` header (Bearer token) or an `X-API-Key` header.
  - **Configurable Port**: The service now supports a configurable HTTP server port via the `PORT`
    environment variable, defaulting to `3000`.

- [#3270](https://github.com/Urigo/accounter-fullstack/pull/3270)
  [`1815013`](https://github.com/Urigo/accounter-fullstack/commit/181501367c4dbdeb0010296e7d418af955f4e75e)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - - **Environment Variable Cleanup**: Removed
  hardcoded and auto-generated environment variables like DEFAULT_FINANCIAL_ENTITY_ID and Gmail
  credentials from the main configuration, promoting a cleaner and more secure setup.
  - **Configuration Loading Improvements**: Updated various packages to support loading environment
    variables from both local and parent directory files, improving flexibility across different
    environments.

## 0.1.0

### Minor Changes

- Initial release of the dedicated Gmail listener service.
- Extracted Gmail inbox watching and financial document ingestion from the main server into a
  standalone package.
- Added support for:
  - Gmail OAuth2 initialization and label setup
  - Gmail Pub/Sub push notifications
  - Processing pending labeled messages
  - Extracting attachments/body/link-based documents and uploading through GraphQL
