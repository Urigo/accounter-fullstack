---
'@accounter/server': patch
---

Count Poalim's securities commission refund (`ביטול עמלה ני"ע CANC SEC FEE`) in the foreign-securities
commission check. The row carries its security only in its reference, which was read for the
`FSEC` fee phrase but not for the refund's, so a cancelled payment's refunded commission was left
out and the charge reported a mismatch between its fee transactions and the bank's commission.
