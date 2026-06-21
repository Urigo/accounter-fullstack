---
'@accounter/server': patch
---


- **Multi-tenant Email Ingestion Architecture**: Implemented a new v2 email ingestion pipeline
  routing inbound mail through Cloudflare Email to a private Gateway, with authoritative tenant
  resolution and data persistence handled by the Server.
- **Security and Authenticity**: Added cryptographic authenticity verification (HMAC-SHA256) for
  Cloudflare-to-Gateway requests, alongside nonce-based replay protection and IP allowlisting.
- **Tenant Isolation and RLS**: Hardened server-side ingestion writes by pinning transactions to the
  grant-validated tenant's RLS context, ensuring that `tenant_isolation` policies are enforced as
  defense-in-depth.
- **Greenfield Gateway Service**: Scaffolded a new, independent `packages/email-ingestion-gateway`
  service that avoids runtime coupling with the legacy `gmail-listener` package.
- **Server Module Migration**: Renamed shared ingestion logic to the `email-ingestion` module and
  established a backward-compatible shim for the legacy listener.
