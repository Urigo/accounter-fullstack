---
'@accounter/server': patch
---

SHAAM 6111 report: the report can now be filed.

- The file holds only the non-zero lines and the mandatory totals (a section takes 150 lines; the
  report used to emit every code and always failed validation), framed and Windows-1255 encoded
  (`Shaam6111File.encodedContent`, file name `DKASPI.DAT`).
- New `Shaam6111Report.validation`: the SHAAM rules plus diagnostics, such as balances of entities
  with no IRS code, a mismatch between 6666 and the books' profit, or a missing withholding file.
  `file` fails with a clear error while there are blocking issues.
- P&L: other expenses (5300), taxes on income (5600) and dividends (5700) are presented as
  expenses, and closing inventory / fuel excise refunds as credits, so 6666 is right.
- Tax adjustment: 110 carries fines, non-deductible gifts and excess travel and salary expenses;
  the net section 20A R&D difference goes to 190 or 200; 400 = 100 + 370; 510 only when a
  preferred tax rate applies. 500 matches the tax report's taxable income.
- Balance sheet: contra accounts keep their sign instead of `Math.abs` hiding misclassified
  balances; retained earnings (9980) add the cumulative after-tax profit to balances mapped to
  9980.
- Entities without an IRS code fall back to their sort code's default IRS code. The ledger is read
  for the requested business, a company is reported as a company, and the withholding file number
  comes from the business admin settings.
