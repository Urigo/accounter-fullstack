---
'@accounter/server': patch
---

Cross-check a securities sale's or redemption's profit/loss with the bank's. Its PnL is recomputed
from its FIFO lots at the bank's own rates and compared with the bank's `nominal_profit_loss_nis`,
`nominal_profit_loss_linkage` and `real_profit_loss_nis`, within ₪2 or a millionth of the proceeds.
The bank reports linkage on the cost side (the negated rate PnL), and its real PnL is the
individual's "lower of the two" result. A mismatch is a ledger error; the disposal is still booked
from its lots.
