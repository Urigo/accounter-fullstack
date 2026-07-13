---
'@accounter/email-ingestion-gateway': patch
---

- **New `IngestReasonCode.SELF_ISSUED`** constant in both `contracts.ts` files (server and gateway):
  Distinguishes self-issued skips from content re-deliveries in duplicate outcomes.
