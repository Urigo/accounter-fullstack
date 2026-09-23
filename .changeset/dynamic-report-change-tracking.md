---
'@accounter/client': minor
'@accounter/server': minor
---

Track what changed in a dynamic report since the draft was last saved.

Every save now records a baseline — the tree and the figures exactly as they stood — and a later
visit renders the difference inline: a signed delta beside each changed row, a subtle accent on the
row, and a tooltip saying what it was. Branches carry the rolled-up delta of their subtree, entities
that entered or left the report are marked, and one that left leaves a ghost row showing what it
used to contribute. A "Compare to" picker selects an older baseline.

A draft also owns the period it was built for, so its figures cannot silently drift onto a range it
was never built for. The diff is suspended, with the reason shown, whenever the baseline is not
comparable — no save yet, or a period or owner other than the one it was computed over.

Also fixes a latent data-loss path this uncovered: a template leaf whose entity had no ledger
activity in the selected period was dropped on load and therefore deleted from the template on the
next save. Such leaves are now preserved.
