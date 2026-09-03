---
'@accounter/server': patch
---

Stop the demo seed from pointing the RLS write target at a transaction's counterparty.

The staging deploy failed on `yarn seed:staging-demo` with
`new row violates row-level security policy for table "transactions"`, aborting the build on the
first use-case. The fixture loader re-set `app.current_business_id` from `transaction.business_id`
before each transaction insert, but `business_id` is the counterparty on the other side of the money
movement (`us-supplier-acme-llc` in the fixture that failed), not the tenant that owns the row.
`tenant_isolation` is `WITH CHECK (owner_id = get_current_business_id())`, so the context named one
business while the row named another and every transaction whose counterparty is not its owner —
which is every realistic transaction — was rejected. The sections before it (businesses, tax
categories, accounts, charges) set the context from `owner_id` and so were unaffected.

The transactions loop now pins the context to `transaction.owner_id ?? adminBusinessId`, and a
failure to set it propagates instead of being swallowed by a `console.warn` — a broken context
otherwise turns into a cascade of policy violations downstream that say nothing about the real
cause. The documents loop, which set no context at all and inherited whatever the previous section
left behind, pins its own owner the same way; it would have been the next section to fail.

This never reproduced locally or in CI because both connect as the `postgres` superuser, which
bypasses RLS even under `FORCE ROW LEVEL SECURITY`. Deployed runs connect as a non-superuser and do
not, so the seed path stays untested against the policies it has to satisfy.
