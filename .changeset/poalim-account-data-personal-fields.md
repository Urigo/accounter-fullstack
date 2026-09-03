---
'@accounter/modern-poalim-scraper': patch
---

Validate the Poalim account-list response per portal

The personal portal returns three per-account fields the business portal never sends —
`defaultSwitch`, `isClosed` and `isPinned`. The item schema is strict, so a single shape cannot
cover both: `AccountDataItemSchema` is now split into `AccountDataItemBusinessSchema` and
`AccountDataItemPersonalSchema` over a shared base shape, with matching
`HapoalimAccountData{Business,Personal}Schema` arrays, and `getAccountsData` picks one based on
`options.isBusiness` — the same way `getForeignTransactions` already branches.

The exported `HapoalimAccountData` stays a single array type whose item keeps those three fields
optional, so consumers reading either portal's response are unaffected.
