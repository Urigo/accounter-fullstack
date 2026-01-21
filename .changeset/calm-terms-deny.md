---
'@accounter/server': patch
---

- **Bank Deposit Charges Provider Enhancement**: The `BankDepositChargesProvider` now includes a new
  public method, `deleteChargeDepositsByChargeIds`, which wraps the new SQL deletion query. This
  method provides an interface for other parts of the application to trigger the removal of bank
  deposit linkages for specific charges.
- **Integration with Charge Deletion Process**: The `deleteCharges` helper function has been updated
  to incorporate the new bank deposit linkage deletion logic. When a charge is deleted, the system
  will now also attempt to clear any associated bank deposit records using the new provider method,
  ensuring data consistency and preventing orphaned entries. Robust error handling has been added
  for this operation.
