---
'@accounter/client': minor
---

The form 1214 page (`/reports/1214`) now edits the year's shareholders: ID number, name,
controlling and material flags, dividend, voting and other rights, salaries, other payments and an
optional link to the shareholder's business. Rows can be added, removed and reordered (the order is
the report order), and the whole list is saved at once. The table shows the dividend-rights total
with a hint when it is not 100%, catches format typos, repeated IDs and more than 99 rows before
saving, and offers to copy last year's shareholders into a year that has none. Switching the year,
leaving the page, reloading it or closing the tab with unsaved edits asks first. The business picker
offers only the active business's own businesses, the only ones a shareholder can be linked to.
