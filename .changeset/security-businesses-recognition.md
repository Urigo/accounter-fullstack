---
'@accounter/server': minor
---

Recognize a per-security business as the foreign-securities side, everywhere the general business
was the only answer.

`foreignSecuritiesBusinessId` was doing three jobs on its own: typing a charge as
`ForeignSecurities`, resolving a securities transaction to the `FOREIGN_SECURITIES` account, and —
via `internalWalletsIds` — telling the ledger and the balance report that a securities movement is
internal. All three assumed the securities side is exactly one business. Once a trade's counterparty
is the security it traded, that assumption breaks: the charge would type as `Common`, the transaction
would resolve to its raw account, and the ledger's counterparty override would stop firing.

So the question those call sites ask is now "is this *a* foreign-securities business" rather than "is
this *the* foreign-securities business", answered by the new
`getForeignSecuritiesBusinessIds(injector)` — the general business plus every business carrying a
`businesses_securities` row, both request-cached.

- `charges/helpers/charge-type.ts` types a charge as `ForeignSecurities` when any of its businesses
  is in that set. (Stored charge types are untouched — derivation only runs for NULL-typed charges.)
- `financial-accounts/helpers/account-by-transaction.helper.ts` resolves the same
  `FOREIGN_SECURITIES` account whichever of them the transaction points at: the portfolio is one
  account regardless of which security was traded.
- `AdminContextProvider` appends the tenant's security businesses to `internalWalletsIds`. **This is
  what keeps the ledger byte-identical**: the main entry's counterparty does not come from
  `transaction.business_id` at all — `ledgerEntryFromMainTransaction` replaces it with the tax
  category of the account whose `account_number` is `foreign_securities`, and that override is gated
  on the counterparty being an internal wallet. It also keeps fee classification
  (`isSupplementalFeeTransaction`) and the balance report's internal-transfer filter behaving exactly
  as before. `normalizeContext` stays synchronous and pure; the enrichment happens on the async paths
  that hit the DB anyway, with raw SQL rather than `SecurityBusinessesProvider` — that provider takes
  its owner id from the admin context, so injecting it back would close a DI cycle. Loading a context
  is now two queries instead of one, and the DataLoader path batches both over the whole key set
  rather than enriching per owner, which would have been an N+1 behind a loader. The ids are merged
  as a set, so the general foreign-securities business is not listed twice.

`UserContext.foreignSecuritiesBusinessId` is exposed to the client, which needs it as the fallback
counterparty option when no security could be resolved for a trade.
