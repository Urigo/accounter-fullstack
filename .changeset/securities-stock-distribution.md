---
'@accounter/server': minor
'@accounter/client': patch
---

Book Poalim stock distributions paid as a dividend in kind. Such an execution has no cash leg, so no
bank transaction ever brought it into a charge and nothing booked it.

- Ingesting securities executions now creates a `FOREIGN_SECURITIES` charge for each dividend in
  kind no charge books yet, and links the two in the new `charges_securities_executions` table.
  Cancelled distributions, distributions the bank later cancelled, and executions in a locked
  ledger period are skipped. The check runs over the
  whole owner, so distributions ingested earlier are picked up by the next upload.
- The securities ledger books each linked distribution as Dr Foreign Securities [trade currency] /
  Cr foreign or local dividend income (by the issuer's locality), at the gross value of the shares
  and the ledger's exchange rate. A bank rate that differs is reported as a ledger error; withheld
  tax, a cancelled distribution and distributions other than a dividend in kind are reported and
  not booked.
- The commission check now covers distributions. When the bank's commission fee sits in a charge of
  its own, the error asks to merge it into the distribution's charge.
- A linked execution counts as charge content: the charge is not cleaned up as empty (deleting it
  explicitly dismisses the distribution, so the next upload does not recreate it), a merge moves
  the link (and types the merged charge as foreign securities), validation stops asking it for
  transactions or a counterparty, and the charges list filters and sorts it by the execution's date.
- Units received as a dividend in kind now cost their gross value in the FIFO cost basis, so a
  later sale or redemption of them can be booked.
- The charge's securities section and the security's history show the linked execution, and the
  executions table gains a gross value column.
