---
'@accounter/mcp-server': minor
---

Add the `accounter_create_tag` write tool. A business with no tags yet had nothing for
`accounter_update_charges_tags` to apply; the new tool creates a tag (optionally nested), refuses a
name the business already has, and returns the new tag's id.
