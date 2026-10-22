---
'@accounter/server': minor
'@accounter/client': patch
---

Book sales of securities from their FIFO lots, splitting the gain into its price and exchange-rate
parts, and work out each sale's capital gain under s.88 with the CPI as the index.

- **Sale ledger.** A sale used to be booked as is, crediting the securities account with the
  proceeds, so no gain or loss was recognised. It is now booked like a redemption: the securities
  account gives up the FIFO cost, and the difference is a price gain or loss
  (`(sell price − buy price) × units × sale rate`). A second, local-currency entry books the rate PnL:
  each lot's cost × the change since the rate the account carries it at. That is the rate the
  purchase's cash movement was booked at (a dividend in kind's value date), or the rate of the last
  revaluation of the account it was held over — read from the revaluations actually booked. The
  account then gives up exactly what it carried the units at. Redemptions get the same second
  entry.
- **New securities tax categories** for that entry: exchange-rate gain and loss on the sale of
  foreign securities. They are offered from the charge's ledger errors like the others, and can be
  pointed at the exchange-revaluation category to merge them. Until they are set — or when a
  purchase's cash movement is not found — the sale is still booked, without the rate entry, and the
  year-end revaluation takes the rate PnL up as before.
- **Existing ledgers change on regeneration.** A sale or a redemption whose ledger is regenerated is
  booked the new way; ledgers in a locked period are not touched.
- **Bank cross-check.** The sale's PnL is recomputed at the bank's own rates and compared with the
  bank's `nominal_profit_loss_nis`, `nominal_profit_loss_linkage` and `real_profit_loss_nis`, within
  ₪2 or a millionth of the proceeds. The bank reports linkage on the cost side (the negated rate
  PnL), and its real PnL is the individual's "lower of the two" result. A mismatch is a ledger error;
  the sale is still booked from its lots.
- **FIFO across the owner's accounts.** Identical securities are sold in purchase order per taxpayer,
  not per account, so a holding moved to a new account keeps its lots. A transfer out of one of the
  owner's accounts carries the lots' cost and place in line to a transfer in of the same units into
  another of them within 10 days; any other transfer in still has no known cost. Within a day, units
  come in before they go out. The lots drawn on are now reported with their acquisitions.
- **Capital gain in GraphQL.** `SecurityExecution.capitalGain` gives a sale's or redemption's gain at
  the Bank of Israel rates of the trade dates: in the origin currency, nominal, and split into price
  and exchange-rate parts, plus the s.88 inflationary amount and real gain using the CPI known on the
  trade dates — a company's split; an individual's foreign-currency securities take the exchange
  rate as the index, as the bank does. It is broken down by lot. A sale with withheld tax is not
  booked yet.
