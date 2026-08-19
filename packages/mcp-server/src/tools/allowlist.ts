/**
 * Tool exposure controls: the allowlist (`MCP_TOOL_ALLOWLIST`) and the write
 * master switch (`MCP_ENABLE_WRITE_TOOLS`), both enforced at the transport
 * boundary in `mcp/handler.ts`.
 *
 * The allowlist is a comma-separated set of tool names parsed into
 * `env.server.toolAllowlist`.
 *
 * **Semantics.** An *empty* allowlist means "no restriction" — every registered
 * tool is exposed. A *non-empty* allowlist restricts both `tools/list` and
 * `tools/call` to exactly the named tools. This is the conventional
 * unset-allowlist reading and, deliberately, the one that keeps phase 1 working
 * out of the box: an operator opts into least-privilege by naming the subset
 * they want, rather than the server refusing to serve any tool until configured.
 *
 * A caveat worth stating loudly (see the note on I1 in the connector todo): when
 * an operator *does* set an allowlist, `accounter_list_business_memberships`
 * should almost always be in it. It is the discovery entry point for business
 * scoping — the model calls it to learn which `memberBusinessId` values exist before
 * passing them to the other tools. Omitting it does not degrade gracefully: the remaining tools
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

/** The subset of a tool needed to decide exposure. */
export interface ExposableTool {
  name: string;
  policy: { mutating?: boolean };
}

export interface ExposureOptions {
  allowlist: readonly string[];
  /** `MCP_ENABLE_WRITE_TOOLS`. When false, mutating tools are never exposed. */
  writeToolsEnabled: boolean;
}

/**
 * Whether a tool is exposed at all: allowed by {@link isToolAllowed} **and**,
 * if it mutates, permitted by the write master switch.
 *
 * The two controls compose one way only — the allowlist can narrow the write
 * tools an operator wants, but naming a write tool in it can never turn writes
 * on. That ordering matters because the allowlist defaults to "everything":
 * without this, shipping the first mutating tool would have handed write access
 * to every existing deployment on upgrade.
 *
 * A tool excluded here is reported as `Unknown tool`, exactly like one excluded
 * by the allowlist — a caller cannot tell a disabled write tool from a
 * nonexistent one, so neither control leaks the capabilities it is hiding.
 */
export function isToolExposed(tool: ExposableTool, options: ExposureOptions): boolean {
  if (tool.policy.mutating && !options.writeToolsEnabled) {
    return false;
  }
  return isToolAllowed(options.allowlist, tool.name);
}
