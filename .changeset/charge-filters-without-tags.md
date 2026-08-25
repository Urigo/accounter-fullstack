---
'@accounter/server': minor
'@accounter/client': minor
'@accounter/mcp-server': minor
---

Filter charges that carry no tags at all.

Server: `ChargeFilter` gains a `withoutTags: Boolean` predicate, honored by `allCharges` and
`chargesWithMissingRequiredInfo` (both go through the shared charge listing helper). It narrows to
charges with an empty tag set, and is independent of `byTags`, which narrows to charges carrying
specific tags.

Client: the charges filters modal gains a "Without Tags" toggle in the Missing Information section.

MCP: `accounter_search_charges` and `accounter_get_charges` expose the new `withoutTags` filter.
