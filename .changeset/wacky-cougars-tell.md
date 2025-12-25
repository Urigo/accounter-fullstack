---
'@accounter/server': patch
---

- **Internal Transfer Logic Refinement**: Updated the categorization logic for
  `ChargeTypeEnum.InternalTransfer` to identify transfers based on whether a charge involves
  transactions across more than one unique account ID, replacing the previous `internalWalletsIds`
  based check.
