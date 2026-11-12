---
'@accounter/server': patch
---

Pair a cancelled securities buy that the bank reports as a sale. The bank reports a cancellation
either under the original's trade type with its values negated, or as the opposite trade with
positive values (a cancelled buy as a sale that brings the money back); the sign of the net amount
tells which (`cancelledTradeType`). Pairing only knew the first form, so such a cancelled buy:

- stayed in FIFO as a lot that was never bought, skewing the cost of later sales of the security;
- showed in the semi-annual securities report as a cancelled sale with no sale to cancel. The
  report now reads the half's buys too, and warns only about a cancelled sale or redemption it
  cannot find;
- failed ledger generation as "a cancelled sale". The ledger now books it like the buy: the base
  entry alone, with the cash coming back.
