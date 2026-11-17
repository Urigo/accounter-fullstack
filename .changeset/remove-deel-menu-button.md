---
'@accounter/client': patch
'@accounter/server': patch
---

Remove the "Pull Deel Documents" item from the user menu. Deel documents are now pulled as a step
of Manual Automations, which shows each charge the pull created or updated.

This narrows who can pull Deel documents from the app: Manual Automations runs `runCronJobs`, which
is limited to business owners, so accountants no longer have a way to trigger the pull from the UI.
`fetchDeelDocuments`, which still accepts accountants, is deprecated in favour of `runCronJobs`.
