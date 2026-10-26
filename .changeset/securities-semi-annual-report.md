---
'@accounter/server': minor
'@accounter/client': minor
---

Add a semi-annual securities report (Income Tax Ordinance s.91(d)): the half-year's sales
turnover, real capital gains and losses, dividend and interest income, the tax on them and the
advance due, as the accountant files it with the Tax Authority — printable to an A4 PDF.

- **`Query.securitiesSemiAnnualReport(year, half, priorYearsLosses, businessId)`.** Sales and
  redemptions are priced from their FIFO lots (`getSecurityCapitalGain`: Bank of Israel rates of
  the trade dates, CPI inflationary amount — a company's real gain). Dividends and interest come
  from the ledger's securities income tax categories, and the tax withheld on each record is split
  into foreign and Israeli tax by the execution behind it. A company is taxed at the regular
  corporate rate on all of it but local dividends (s.126(b)); foreign tax is credited per income
  bucket, capped at the tax on it, and Israeli tax withheld at source reduces the advance.
  Carried-forward losses are an input, and the second half carries the first half's unused loss.
  What cannot be worked out is listed as issues rather than guessed.
- **Reports → Securities Semi-Annual Report.** The accountant's six-line letter in Hebrew with
  English subtitles, the calculation behind it, and appendices of every sale and income record.
  _Print / Save PDF_ prints it on A4 under a file name of the report's year and half; the app's
  chrome is now left out of any printed page.
