---
'@accounter/server': patch
---

FIFO drops a cancelled securities execution together with the execution it cancels. The bank
reports a cancellation as a row of its own and leaves the original as it was; dropping only the
cancellation let a cancelled sale still use up lots (and a cancelled buy add one), skewing the cost
— and the booked gain — of every later sale of the security. The original is the latest execution
at or before the cancellation of the same security, account, trade type and amount.
