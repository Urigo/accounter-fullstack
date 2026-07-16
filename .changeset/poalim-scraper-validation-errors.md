---
'@accounter/scraper-app': patch
---

Surface Poalim schema validation failures instead of silently swallowing them. The
modern-poalim-scraper runs Zod validation internally (`validateSchema: true`) and returns
`{ data, isValid, errors }`, setting `data` to `null` and `isValid` to `false` on a failed
validation. `scrapePoalim` only read `data`, so a failed `getAccountsData` validation looked like
"no accounts" and the run reported success with no data; the same silent swallow applied to the
per-account ILS, foreign, and SWIFT requests. Each Poalim request now checks `isValid` and throws a
descriptive error (including the validation issues), which propagates to the run runner and is
emitted as a `task-error` so the user is notified.
