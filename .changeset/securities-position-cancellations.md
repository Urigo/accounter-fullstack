---
'@accounter/server': patch
---

A security's position (`securityHoldings`, `securityBusinessHistory`) leaves out a cancelled
execution and its cancellation, as FIFO does (`pairCancellations`). It counted both: a cancelled
buy the bank reports as a sale added to `totalBought` and `totalSold` and skewed `averageCost`, and
a cancellation reported with its values negated doubled the amounts. The cancelled rows still date
the ingested history (`historyStartDate`, `lastExecutionDate`).
