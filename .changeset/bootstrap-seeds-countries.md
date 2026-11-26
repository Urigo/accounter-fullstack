---
'@accounter/server': patch
---

`bootstrapNewClient` now fills the whole countries table instead of adding only the new tenant's own
country (and under its code as the name). On a database that was never seeded by script, a new
tenant could not create a business in any other country and the country pickers listed one entry.
