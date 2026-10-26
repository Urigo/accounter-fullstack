---
'@accounter/server': patch
---

Cost a security disposal from the FIFO lots of its own account, carrying lots across transfers
between the owner's accounts.

- **FIFO per account.** A disposal draws only on the lots of the account it was made in, as the
  bank computes and withholds its tax. The owner's whole history is replayed: a transfer out of one
  of the owner's accounts carries the lots' cost and purchase-order place into the account that
  receives the same units within 10 days; any other transfer in still has no known cost. Within a
  day, units come in before they go out.
- **Lots.** The FIFO cost basis now reports the lots it drew on, with their acquisitions.
- **Redemptions** read the new owner-wide history, so a redeemed bond moved from another account
  keeps its cost, and their cost-basis errors name the account.
