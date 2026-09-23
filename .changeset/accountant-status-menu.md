---
'@accounter/client': patch
---

Split the accountant-status dropdown into a presentational `AccountantStatusMenu` (value, onChange,
disabled, optional tooltip and a compact size, with a neutral placeholder for a missing status) and
the existing `UpdateAccountantStatus` mutation wrapper, which now renders it with unchanged
behaviour. The dynamic report's approval column will reuse the menu.
