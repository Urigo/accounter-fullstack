---
'@accounter/client': patch
---

Owner inputs now offer only the businesses the user actually owns, and a business switcher that
keeps its names.

Every "Owner" input used to list all businesses or financial entities — including counterparties
that can never be an owner. They now read `allAdminBusinesses` (as the charges filter already did):
business-ledger and trial-balance filters, the documents filter, the depreciation report filter, the
dynamic report toolbar, the PCN874 validation filter and the Shaam-6111 filter. Where there is only
one option to pick, the input is disabled and shows it, rather than pretending to offer a choice;
single-select owner fields also pre-select that value so the submitted filter matches what is
displayed. The Green Invoice sync modal loses its hard-coded owner UUID default.

Fixes the business scope switcher in the user menu rendering out-of-scope memberships as bare
UUIDs. Membership names resolve through `financial_entities`, which RLS narrows to the requested
`X-Business-Scope`, so once a scope was picked the names of the user's *other* businesses — the very
list needed to leave that scope — became unreadable. A new permissive `SELECT` policy lets a user
always read the `financial_entities` row of a business they are a member of. API-key requests, which
have no user id, are unaffected.
