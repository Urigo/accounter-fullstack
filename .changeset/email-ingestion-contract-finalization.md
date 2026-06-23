---
---

Workstream E (contract finalization): add gateway treatment **parity tests**
(`treatment.parity.test.ts`) that pin the v2 treatment to the legacy `handleMessage` behavior per
provider category, and update the design docs (`business-recognition-plan.md`, `data-flow.md`,
`architecture-plan.md`) to reflect the shipped recognition-in-control + treatment-in-gateway +
inline-bytes-persistence design.

No package behavior change — the v2 contract (grant `business_id` + migration, `senderEvidence`
control input, `businessEmailConfig` control output, inline `content` ingest field, gateway
`server-client` types + mutations) was already implemented incrementally across Workstreams A–D.
