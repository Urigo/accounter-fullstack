---
'@accounter/client': minor
---

Add a CPI linkage calculator page (Reports → CPI Linkage Calculator, `/reports/cpi-calculator`),
built on the `priceIndexLinkage` and `priceIndexValues` queries. It links an amount between two
dates by the "known" index (Income Tax Ordinance s.88) or the index for a month on each side, shows
the linked amount, linkage difference, change and both index values (including cross-base values),
and charts the monthly CPI over the range. The calculation is kept in the URL, so it can be shared.
