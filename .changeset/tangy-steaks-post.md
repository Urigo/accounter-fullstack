---
'@accounter/server': patch
---

- **Refactored Ledger Storage Helper**: The `storeInitialGeneratedRecords` function in
  `ledgrer-storage.helper.ts` has been updated to accept a `chargeId` string instead of a full
  `charge` object. It now internally fetches the `charge` using `ChargesProvider` to ensure the most
  up-to-date data is used.
- **Enhanced Data Integrity**: A null check for the fetched `charge` object has been added within
  `storeInitialGeneratedRecords`, preventing potential errors and ensuring that ledger records are
  only processed for existing charges.
- **Widespread Resolver Updates**: All relevant ledger generation resolvers across the application
  have been updated to pass `charge.id` to the refactored `storeInitialGeneratedRecords` function,
  aligning with the new signature and ensuring consistent behavior.
