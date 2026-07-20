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

import { fileURLToPath } from 'node:url';

export const PACKAGE_NAME = '@accounter/mcp-server';

/**
 * Placeholder startup entrypoint. Later prompts replace this with the HTTP
 * server bootstrap, health route, and MCP transport wiring.
 */
export function main(): void {
  // No-op for now.
}

// Only auto-run when executed directly (e.g. `node dist/index.js`), never when
// imported by tests or other modules. Compare via fileURLToPath so paths with
// spaces or other special characters (URL-encoded in import.meta.url) match.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
