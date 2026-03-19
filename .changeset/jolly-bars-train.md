---
'@accounter/gmail-listener': patch
---

- **HTTP Server Integration**: An HTTP server was integrated into the `gmail-listener` service to
  expose its functionalities via a RESTful API.
- **API Endpoints**: New API endpoints were added for health checks (`GET /health`), controlling
  Pub/Sub listening (`POST /start-listening`, `POST /stop-listening`), and manually triggering
  pending message handling (`POST /handle-pending-messages`).
- **Authentication**: All new API endpoints are protected by an API key, which can be provided via
  an `Authorization` header (Bearer token) or an `X-API-Key` header.
- **Configurable Port**: The service now supports a configurable HTTP server port via the `PORT`
  environment variable, defaulting to `3000`.
