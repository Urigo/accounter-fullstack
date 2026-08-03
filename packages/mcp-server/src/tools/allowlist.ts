/**
 * Tool allowlist enforcement (`MCP_TOOL_ALLOWLIST`).
 *
 * The allowlist is a comma-separated set of tool names parsed into
 * `env.server.toolAllowlist`. Until now it was parsed and never read — every
 * registered tool was advertised and dispatchable regardless. That is harmless
 * while phase 1 is read-only, but a real control gap the moment mutating tools
 * land, so enforcement is wired in here at the transport boundary.
 *
 * **Semantics.** An *empty* allowlist means "no restriction" — every registered
 * tool is exposed. A *non-empty* allowlist restricts both `tools/list` and
 * `tools/call` to exactly the named tools. This is the conventional
 * unset-allowlist reading and, deliberately, the one that keeps phase 1 working
 * out of the box: an operator opts into least-privilege by naming the subset
 * they want, rather than the server refusing to serve any tool until configured.
 *
 * A caveat worth stating loudly (see the note on I1 in the connector todo): when
 * an operator *does* set an allowlist, `accounter_list_businesses` should almost
 * always be in it. It is the discovery entry point for business scoping — the
 * model calls it to learn which `businessId` values exist before passing them to
 * the other tools. Omitting it does not degrade gracefully: the remaining tools
 * still work, just with no way to discover a business id. Enforcement here makes
 * an omitted tool genuinely absent (hidden from `tools/list` *and* rejected by
 * `tools/call`) rather than silently unscoped, which is the safer failure.
 */

/**
 * Whether `toolName` is permitted by `allowlist`. An empty allowlist permits
 * every tool; a non-empty allowlist permits only its members.
 */
export function isToolAllowed(allowlist: readonly string[], toolName: string): boolean {
  return allowlist.length === 0 || allowlist.includes(toolName);
}
