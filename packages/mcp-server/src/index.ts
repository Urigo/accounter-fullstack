/**
 * Accounter MCP server entrypoint.
 *
 * Phase 1 (see docs/mcp/spec.md) exposes a curated, read-only subset of
 * Accounter capabilities to Claude clients over a remote MCP (Model Context
 * Protocol) endpoint.
 *
 * This module wires up process-level concerns (top-level error handling) and
 * starts the HTTP server. The transport, OAuth discovery, and tool registry are
 * added in subsequent, incremental steps.
 */

import { fileURLToPath } from 'node:url';
import { log } from './logger.js';
import { start } from './server.js';

export const PACKAGE_NAME = '@accounter/mcp-server';

export { start } from './server.js';

/**
 * Install last-resort handlers so an unexpected error is logged in structured
 * form before the process exits, rather than crashing with a bare stack trace.
 */
export function installProcessErrorHandlers(): void {
  process.on('uncaughtException', error => {
    log('error', 'uncaught exception', { error: String(error) });
    process.exit(1);
  });
  process.on('unhandledRejection', reason => {
    log('error', 'unhandled promise rejection', { reason: String(reason) });
    process.exit(1);
  });
}

/** Startup entrypoint: install error handlers and start the HTTP server. */
export function main(): void {
  installProcessErrorHandlers();
  try {
    start();
  } catch (error) {
    log('error', 'fatal startup error', { error: String(error) });
    process.exit(1);
  }
}

// Only auto-run when executed directly (e.g. `node dist/index.js`), never when
// imported by tests or other modules. Compare via fileURLToPath so paths with
// spaces or other special characters (URL-encoded in import.meta.url) match.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
