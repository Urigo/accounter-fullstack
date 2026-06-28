---
'@accounter/server': patch
---

Fix false `GRANT_INVALID` rejections in v2 email ingestion. A slow Cloudinary upload could make the
gateway's ingest call time out and retry after the server had already consumed the single-use grant,
so the retry was rejected even though the first attempt had succeeded. The server now performs an
early idempotency check before consuming the grant (returning `DUPLICATE` on retry), the gateway no
longer retries ingest on timeout, and the ingest timeout was raised from 10s to 30s.
