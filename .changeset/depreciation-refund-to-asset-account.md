---
'@accounter/server': patch
---

- **Two ways to book a cost refund.** A charge's disposal rows are now generated after its own
  entries, which tell, per refund currency, how the refund was booked:
  - **by a credit-note document** to the charge's tax category (a credit invoice crediting the tax
    category in the refund's currency, local for a local refund): as before, the cost reduction is moved from the
    tax category to the asset account, and checked by the proceeds check, or for a foreign-currency
    refund by the in-currency check and its exchange entry;
  - **by the refund record itself**, without such a document: the cost reduction is booked
    against the charge's counterparty (its main business), Dr counterparty / Cr asset account, in
    the refund's currency (the refunded amount itself for a foreign-currency refund), next to the
    depreciation correction. It settles against the money the charge receives from the
    counterparty: the charge's business balance checks it, and books the counterparty's
    exchange-rate difference (the refund converts at the asset's cost-basis rate) to the
    exchange-rates account. A refund with neither a credit note nor a counterparty is a ledger
    error.
- Only documents count as a credit note: misc expenses, transactions and fees crediting the tax
  category don't stand in for one, whatever the tax category is (the asset account included, which
  carries the charge's other movements).
- A credit note to the asset account itself is checked against the charge's documents only: the
  asset account's other movements (such as the refund of an asset that is not depreciated) are meant
  to leave a balance there. A clearing tax category keeps every entry counted.
- Booking both (a credit note crediting the asset account, and the refund record) counts the refund
  twice; the counterparty is left unbalanced, which the business balance reports.
- Sales always take the charge's tax category; the yearly depreciation charge is unchanged.
- The proceeds and in-currency checks name the account, and suggest booking the refund with a
  credit-note document to the charge's tax category, or leaving it to the refund record.
