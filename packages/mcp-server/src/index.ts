/**
 * Accounter MCP server entrypoint.
 *
 * Phase 1 (see docs/mcp/spec.md) exposes a curated, read-only subset of
 * Accounter capabilities to Claude clients over a remote MCP (Model Context
 * Protocol) endpoint.
 *
 * This is the scaffolding entrypoint (Prompt 01). It intentionally performs no
 * runtime work yet — HTTP transport, OAuth discovery, and the tool registry are
 * added in subsequent, incremental steps. Keeping this a no-op keeps the
 * package compilable and importable without locking in a runtime framework.
 */

export const PACKAGE_NAME = '@accounter/mcp-server';

/**
 * Placeholder startup entrypoint. Later prompts replace this with the HTTP
 * server bootstrap, health route, and MCP transport wiring.
 */
export function main(): void {
  // No-op for now.
}

// Only auto-run when executed directly (e.g. `node dist/index.js`), never when
// imported by tests or other modules.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
