---
'@accounter/client': patch
---

Fix empty `generalContacts` handling for businesses. When inserting a business without any general
contacts, an empty string was stored as the business email, which later parsed into `['']` (an
invalid email) and triggered a validation error when editing the business. The insert modal now
stores `undefined` instead of an empty string, and the edit form filters out empty entries when
parsing the stored email.
