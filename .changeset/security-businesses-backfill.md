---
'@accounter/server': patch
---

Add `yarn backfill:security-businesses`, the one-time backfill that gives already-ingested securities
their businesses.

Ingestion now creates a business per security as executions arrive, but the history that predates it
has none, and its trades still point at the general foreign-securities business. The script closes
that gap in two idempotent steps:

1. **A business per ISIN** out of `accounter_schema.poalim_securities_transactions`, with a
   `POALIM_SECURITY_KEY` identifier for every Poalim key seen reporting that ISIN — so two keys for
   one instrument collapse onto one business. Sort code, IRS code, country and tax category are
   inherited from the tenant's general foreign-securities business, matching what
   `ensureSecurityBusiness` does.
2. **Re-point the trades** whose description names exactly one key that resolves. Only transactions
   currently pointing at the general foreign-securities business are touched — anything else is a
   human decision the script has no business overwriting — and only non-fee rows, since the fee side
   stays with the bank.

**Dry-run by default**; `--apply` writes, `--owner=<uuid>` limits the run to one tenant. The report
counts what was (or would be) created, linked and re-pointed, and names the cases it deliberately
left alone: security keys reporting no ISIN (the ISIN is the identity and cannot be invented from the
key — those are assigned by hand from the charge UI), descriptions naming more than one security, and
keys with no business behind them.

It sets `app.current_business_id` per tenant, exactly as the server does per request, so it behaves
the same whether or not the connecting role bypasses RLS.
