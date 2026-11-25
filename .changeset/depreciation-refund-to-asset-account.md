---
'@accounter/server': patch
---

- **Cost refunds booked to the asset's account**: a cost refund whose charge credits the asset's
  account directly (e.g. misc expenses crediting the acquisition account), measured in the refund's
  currency (its foreign currency when entered in one, else the local currency), now books only its
  depreciation correction: no cost-reduction row from the charge's tax category, and no exchange
  entry. The charge's own entries must credit the asset account with at least the refunded amount,
  in the refund's currency (the account may carry other movements, such as the refund of an asset
  that is not depreciated); otherwise it's a ledger error. A gap between the rate the refund was
  booked at and the asset's cost-basis rate stays in the asset account, as the difference between
  its book and tax cost. Sales and the other refunds keep the charge's tax category and its checks.
- Disposal rows of a charge are now generated after its own entries, which tell where each refund
  was booked.
- The proceeds, in-currency and asset-account checks name the account and suggest booking the
  refund to the asset's account, or setting the charge's tax category to the account it is
  credited to.
