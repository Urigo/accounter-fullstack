---
'@accounter/server': patch
---

- **New Country Seeding Utility**: A new helper file, `seed-countries.helper.ts`, has been
  introduced to centralize the logic for managing country data, including retrieval and database
  seeding.
- **Dynamic and Idempotent Country Seeding**: The new utility provides a `seedCountries` function
  that dynamically inserts country names and codes from an enum into the database, utilizing
  `ON CONFLICT (code) DO NOTHING` to ensure idempotency.
- **Refactored Seed Script**: The main `scripts/seed.ts` file has been updated to use the new
  `seedCountries` utility, replacing a large, hardcoded SQL `INSERT` statement with a cleaner, more
  maintainable function call.
