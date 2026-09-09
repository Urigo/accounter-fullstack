---
'@accounter/client': patch
---

Surface wildcard support in the business "Email Addresses" recognition field.

Business recognition emails (`suggestion_data.emails`) already accept wildcard patterns such as
`*@cloudflare.com`, for suppliers that send each invoice from a unique address — both the write-side
schema and the email-ingestion issuer lookup support it — but nothing in the UI said so.

An info icon next to the "Email Addresses" label now carries a tooltip explaining the `*` semantics,
the concrete example, and the concrete-label requirement that rejects an over-broad pattern like
`*@*.com`.

The entry input also moves from `type="email"` to `type="text"`. A valid wildcard entry may carry `*`
in the domain (e.g. `*@*.cloudflare.com`), which fails the browser's built-in email constraint
validation — so while the input sat inside the form, it blocked saving the very patterns the tooltip
now advertises.
