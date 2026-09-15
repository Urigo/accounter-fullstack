---
'@accounter/modern-poalim-scraper': patch
---

Fail loudly when Amex or Isracard login is rejected, instead of continuing with an unauthenticated
session.

Both scrapers posted to `performLogonI` and discarded the response. The endpoint answers `200` with a
JSON body describing the outcome, so a rejected login — wrong ID, password or card suffix, or a
locked account — looked identical to a successful one. The scraper carried on to `DashboardMonth` and
`CardsTransactionsList`, which returned whatever the site serves an anonymous session; with
`validateSchema` off, that surfaced much later as empty or nonsensical results, and with it on, as a
Zod parse error pointing at the transactions schema rather than at the credentials.

`login()` now types the response and throws before returning. Amex rejects on `status === '2'` or
`returnCode === 'E'`; Isracard requires `status === '1'` and `returnCode === '1'`, since its success
codes are the documented pair and anything else is a failure. The thrown message prefers the
response's `message` field, which carries the site's readable Hebrew text (e.g. `לפחות אחד מהפרטים לא
מתאים, יש לבדוק ולנסות שוב`). It falls back to `clbMessage` — the same text reversed — when `message`
is empty, and finally to the raw `status`/`returnCode` pair, so the error is never blank. A `null`
body (the `204` case in `fetchPostWithinPage`) also throws, rather than being treated as success.
