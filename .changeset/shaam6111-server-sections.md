---
"@accounter/server": patch
---

SHAAM 6111 report: correct the sections. Other expenses (5300), taxes on income (5600) and
dividends (5700) are presented as expenses, and closing inventory and fuel excise refunds as
credits, so 6666 is right. Tax adjustment lines: 110 for fines, non-deductible gifts and excess
travel and salary expenses; the net section 20A R&D difference in 190 or 200; 400 = 100 + 370;
510 only with a preferred tax rate; 500 matches the tax report. Balance sheet contra accounts keep
their sign instead of `Math.abs` hiding misclassified balances, and retained earnings (9980) add the
cumulative after-tax profit to balances mapped to 9980.
