---
'@accounter/server': minor
---

Add `Query.securitiesSemiAnnualReport(year, half, priorYearsLosses, businessId)`: the semi-annual
securities report (Income Tax Ordinance s.91(d)) — the half-year's sales turnover, real capital
gains and losses, dividend and interest income, securities expenses, the tax on them and the
advance due, as the accountant files it with the Tax Authority.

Sales and redemptions are priced from their FIFO lots (`getSecurityCapitalGain`: Bank of Israel
rates of the trade dates, CPI inflationary amount — a company's real gain). Dividends and interest
come from the ledger's securities income tax categories, and the tax withheld on each record is
split into foreign and Israeli tax by the execution behind it. A company is taxed at the regular
corporate rate on all of it but local dividends (s.126(b)); foreign tax is credited per income
bucket, capped at the tax on it, and Israeli tax withheld at source reduces the advance.
Carried-forward losses are an input, and the second half carries the first half's unused loss. A
capital loss of the year also offsets the securities dividends and interest (s.92(a)(4)). The
securities expenses — what the ledger booked on the securities fees and the new
`FINANCIAL_CONSULTANCY` securities tax category — come off the capital gain, then the income. What
cannot be worked out is listed as issues rather than guessed.

Also adds `SecuritiesTaxCategoryKey.FINANCIAL_CONSULTANCY`: a securities settings slot for the tax
category investment advice is booked to; the ledger does not book to it.
