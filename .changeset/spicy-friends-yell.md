---
'@accounter/server': patch
---

- **DataLoader Cache Keys**: Ensured stable and consistent cache keys for DataLoader instances to
  improve cache hits and prevent unexpected behavior.
- **Date Handling**: Standardized date handling in cache keys to avoid issues caused by timezones or
  inconsistent date representations.
