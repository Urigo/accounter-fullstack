---
'@accounter/server': patch
---

Stop marking every security business as foreign. Poalim securities ingestion hardcoded
`businesses_securities.is_foreign` to `true`, so Israeli funds and bonds (including dollar-denominated
ones) showed a "Foreign" badge. The flag is now derived from the issuer country the feed reports,
falling back to the ISIN's country prefix, and left null when neither is readable. A re-scrape now
corrects the flag on an existing security business, and a migration re-derives it for rows already
stored.
