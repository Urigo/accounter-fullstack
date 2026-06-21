---
'@accounter/email-ingestion-gateway': patch
---

- **Multi-tenant Email Ingestion Architecture**: Implemented a new v2 email ingestion pipeline
  routing inbound mail through Cloudflare Email to a private Gateway, with authoritative tenant
  resolution and data persistence handled by the Server.
- **Security and Authenticity**: Added cryptographic authenticity verification (HMAC-SHA256) for
  Cloudflare-to-Gateway requests, alongside nonce-based replay protection and IP allowlisting.
- **Greenfield Gateway Service**: Scaffolded a new, independent `packages/email-ingestion-gateway`
  service that avoids runtime coupling with the legacy `gmail-listener` package.
