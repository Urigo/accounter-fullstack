---
'@accounter/client': patch
---

Block accidental repeats of every client mutation where a repeat does harm, not only
`IssueMonthlyDocuments`. A repeat with identical variables, while the first call is in flight or
within 20 seconds of it settling, is no longer sent. The guard now covers mutations that create
records (documents, uploads, charges, deposits, business-trip expenses, tags, businesses, accounts,
contracts, misc expenses, API keys, report comments), reach an external service (issuing and
closing documents, invitations, Green Invoice and Deel sync) or run paid OCR. Updates, toggles and
deletes are left unguarded.

The guard moved to `helpers/mutation-dedupe.ts` (`claimMutationCall`, `MUTATION_DEDUPE_WINDOW_MS`)
so hooks that call `useMutation` directly can use it too. It now keys files by identity, so two
different uploads with otherwise identical variables are no longer treated as duplicates.
