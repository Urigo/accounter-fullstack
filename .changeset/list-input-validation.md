---
'@accounter/server': patch
'@accounter/client': patch
---

Reject duplicate and overlapping entries in a business' list inputs.

Email lists — general contacts, billing emails, auto-match recognition emails, and the emails in the
client dialog — no longer accept the same address twice, compared case-insensitively. Internal email
links reject an exact repeat, which would otherwise fetch the same documents twice. Auto-match
phrases reject a phrase that repeats or contains / is contained in another: adding `GOOGLE` when
`GOOGL` exists says it is already covered, and adding `GOOGL` when `GOOGLE` exists asks to remove
`GOOGLE` first. Conflicts are blocked when the entry is added, with an inline message, and again by
the form schemas on submit.

Phrases and links are compared case-sensitively, because that is how they are used: transaction and
charge suggestions match with a case-sensitive `description.includes(phrase)`, so `GOOGLE` and
`Google` match different descriptions and both may be needed.

On the server, every write of a business' suggestion data (insert, update, batch update, merge) and
every client email write drops entries that are redundant without changing what matches: exact
repeats of phrases and internal links, and case-insensitive repeats of emails. Overlapping phrases
are deliberately left alone there. The configuration tab re-sends the full phrase list on every
save, so pruning `["GOOGL", "GOOGLE"]` down to one would silently change matching for businesses
that already hold both.
