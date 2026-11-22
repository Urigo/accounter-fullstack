---
'@accounter/modern-poalim-scraper': patch
---

Hapoalim foreign transactions (personal) schema: the `contraCurrencyCode`, `currencyRate` and
`rateFixingCode` metadata attributes no longer require both `disabled` and `hidden`, so responses
that carry only one of them pass validation.
