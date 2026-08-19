---
'@accounter/server': minor
---

Give every traded security a business of its own.

A foreign security has so far had no identity in the system: its executions live only in
`accounter_schema.poalim_securities_transactions`, and the cash leg points at the single general
"Foreign Securities" business. This adds the record a security needs to be a counterparty and to own
a page — nothing reads or writes it yet beyond the new GraphQL surface.

Identity is the **ISIN**, which forces an indirection: the rest of the codebase addresses a security
by Poalim's proprietary security key (parsed out of the transaction description by
`extractSecurityKeys`), and `accounter_schema.poalim_securities` — the reference feed that key joins
to — carries no ISIN at all. The ISIN appears only on execution rows. So two tables, not one:

- `accounter_schema.businesses_securities` — a 1:1 extension of `businesses`, in the shape of
  `businesses_admin` / `clients`: the presence of a row is what makes a business a security. Holds
  the ISIN (unique per owner) plus descriptors cached off the ingested row that introduced it
  (symbol, names, exchange, currency, item/stock type, ETF/foreign flags, issuer country), so a
  business list renders without joining the securities feeds.
- `accounter_schema.security_identifiers` — how each source names the security, as
  `(identifier_type, identifier_value) → business`. `POALIM_SECURITY_KEY` and `ISIN` to start; a
  second broker is one `ALTER TYPE ... ADD VALUE`, not a new column. Several identifiers may point
  at one security business — that is how two Poalim keys collapse onto a single ISIN — while the
  unique index on `(owner_id, identifier_type, identifier_value)` keeps the reverse lookup
  single-valued.

Both are owner-scoped with FORCE RLS and a `tenant_isolation` policy, like the `poalim_*` tables.

`SecurityBusinessesProvider` (in the `foreign-securities` module, which owns securities knowledge)
exposes the loaders those lookups need plus `ensureSecurityBusiness`, which is idempotent by ISIN:
the financial entity, the business and the securities row are created in one transaction whose last
statement is the one the `(owner_id, isin)` unique index arbitrates, so two concurrent ingests can
never leave a half-built business behind — the loser rolls back and re-reads the winner. New
businesses are named `ENGNAME (SYMBOL)` (falling back through the descriptors to the ISIN, so a name
is never empty) and inherit sort code, IRS code, country and tax category from the tenant's general
foreign-securities business, so they behave like it wherever those fields drive reporting. They
carry no suggestion phrases: a security must never win a description-based business match.

Schema: `LtdFinancialEntity.securityInfo: SecurityBusiness`, the `SecurityBusiness` /
`SecurityIdentifier` types, the `SecurityIdentifierType` enum, and
`Query.allSecurityBusinesses` for pickers that should offer securities only.

`BusinessesProvider.replaceBusiness` now rewires `security_identifiers` when businesses are merged,
but only onto a target that is itself a security business — the FK points at
`businesses_securities`, and anything left behind is cascaded away with the merged security row.
