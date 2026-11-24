---
'@accounter/client': patch
---

Charges filters: a date range or owner the user cleared stays cleared when the filters dialog is
reopened, including after a reload or from a shared link. Before, the dialog filled the default
last-year range and the admin-business owner back in, so applying again quietly re-limited the
results. The defaults now only seed a fresh visit with no filter applied, and "Reset" still restores
them.
