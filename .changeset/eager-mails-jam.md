---
'@accounter/server': patch
---

- Add `exemptDealer`, `optionalVAT`, `isReceiptEnough`, `isDocumentsOptional` and `isActive` to
  `BatchUpdateBusinessInput` in `financial-entities/typeDefs/businesses.graphql.ts`.
- No resolver change is needed: these fields are already handled by the shared
  `updateSingleBusiness` helper (`helpers/update-business.helper.ts`), and
  `BatchUpdateBusinessInput` remains a strict structural subset of `UpdateBusinessInput`, so it is
  still passed straight through. `isActive` flows to the core financial-entity update via
  `hasFinancialEntitiesCoreProperties`; the rest map to the business row update. Tags and
  description were already supported through the existing `suggestions` input.
