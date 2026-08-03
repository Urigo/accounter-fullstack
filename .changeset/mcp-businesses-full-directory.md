---
'@accounter/mcp-server': patch
---

Split the MCP businesses tools into memberships vs. the full directory.

- **Rename** the membership-discovery tool `accounter_list_businesses` →
  `accounter_list_business_memberships`. Its behavior is unchanged (pure, no upstream call, lists the
  caller's own memberships and role in each), but the name now says what it returns. It remains the
  scope-discovery entry point and still leads `tools/list`.
- **Add** `accounter_list_businesses`, a read-only lookup — alongside `accounter_list_tags` and
  `accounter_list_tax_categories` — that lists every business known to the system (id, name,
  `ownerId`, active flag) via the upstream `allBusinesses` query, not just the caller's memberships.
  Optional `nameContains`, `activeOnly`, and `businessIds` filters, with the same deterministic
  sort + size cap and echoed `scope.businessIds` as the other lookups.

**Breaking for connector callers**: the membership tool is now `accounter_list_business_memberships`.
Any `MCP_TOOL_ALLOWLIST` that named `accounter_list_businesses` for scope discovery must be updated,
since that name now refers to the full-directory lookup.
