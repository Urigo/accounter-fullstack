---
'@accounter/email-ingestion-gateway': patch
'@accounter/server': patch
---

Fix email-ingestion falsely marking forwarded supplier invoices as self-issued (SELF_ISSUED
DUPLICATE) and silently dropping them.

When a supplier (e.g. Aiven) emails a tenant's Accounts-Payable Google Group, the mailing list
rewrites the quoted `From:` to the group's own forwarding address (`'Aiven Billing' via Account
Payables <ap@…>`). The real issuer's address survived only as a body contact/footer `mailto:` link,
which the issuer-candidate extractor did not harvest — so the only recognized address was the
forwarder, hard-coded as a self-issuing provider. The email was bound to the tenant's own business
and skipped at ingest as a `DUPLICATE` (`SELF_ISSUED`), inserting nothing.

- **Gateway `mime-extractor.ts`**: harvest any body `mailto:` link (not only header-anchored
  `From:`/`Reply-To:`/`Sender:` addresses) as lower-priority issuer candidates, so a real issuer
  reachable only through a contact/footer link is still recovered for server-side recognition.
- **Server `email-ingestion-control.resolver.ts`**: a positive *external* business recognition now
  wins over the single-address self-issued heuristic. When recognition identifies a real
  counterparty (any business other than the tenant), the documents are attributed to it and the
  self-issued check is skipped, so a supplier invoice routed through the tenant's own forwarding
  group is no longer misclassified.
- **Server `email-ingestion-ingest.provider.ts`**: the self-issued / tenant-matched path now
  **QUARANTINEs** (recorded, visible, reprocessable) instead of silently returning `DUPLICATE` with
  nothing written, so a misclassification is never silent data loss. The `SELF_ISSUED` reason code
  now pairs with the `QUARANTINED` outcome.
