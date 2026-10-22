---
'@accounter/server': minor
'@accounter/client': patch
---

Resolve the counterparty of a foreign-securities charge that holds trades of more than one
security. Each traded security is its own business, so a charge that held two of them had two
counterparty candidates, no counterparty, and was flagged as missing one.

- A security whose trades cancel out within the charge (a buy reversed by a sell of the same
  amount, as when a trade is rebooked to another series) no longer competes for the counterparty.
  Fees are left out of the netting, and only securities businesses are dropped, so any other second
  candidate is still reported. This applies to both the single-charge path and the charges list.
- A charge spanning several securities with real exposure in each (say, a switch from one fund to
  another) has no single counterparty and is no longer flagged as missing one, provided every
  candidate is a security.
- The securities ledger now lets every bought security keep its holding balance. Before, only the
  first booked main entry was allowed to stay unbalanced, so on a charge buying two securities the
  other one was reported as unbalanced.
- New GraphQL fields: `ForeignSecuritiesCharge.counterparties` (the main-counterparty candidates),
  and `ChargeSecurity.netAmount` and `ChargeSecurity.isOffsetting`.
- The charges table shows "N securities", with a popover listing them, instead of a red "Missing"
  for a multi-security charge. The charge's Foreign Securities section shows each security's net
  amount and its role: main counterparty, counterparty k of N, or nets to zero. Securities that
  cancel out are dimmed and listed last.
