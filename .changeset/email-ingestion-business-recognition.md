---
'@accounter/server': patch
---

Recognize the issuing business in the v2 email-ingestion control step: the `requestIngestControl`
flow now resolves the provider business from gateway-supplied sender evidence under the tenant's RLS
context, loads its email-listener config, and binds the recognized business into the ingest grant
(new nullable `email_ingestion_grants.business_id` column) so downstream stages can attribute
documents without trusting gateway input. Adds `IngestControlInput.senderEvidence` and
`IngestControlDecision.businessEmailConfig` to the schema.
