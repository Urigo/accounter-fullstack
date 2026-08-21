---
'@accounter/client': patch
---

Stop padding securities quantities and prices to four decimals.

The bank reports quantities and trade prices with four decimal places, but almost all of them are
trailing zeros — a holding of 100 shares read as `100.0000`. The securities screen, the security
section on a business page, and the Portfolio activity table inside a charge now render these
through a single `formatSecurityDecimal` helper that keeps up to four fraction digits without a
minimum, so `100.0000` shows as `100` and `12.5000` as `12.5` while genuinely fractional ETF and
mutual-fund values keep every digit they need. Replaces the fixed-precision `formatSecurityNumber`,
which had no other callers left.
