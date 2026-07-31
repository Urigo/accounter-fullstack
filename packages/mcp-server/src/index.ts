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

import { pathToFileURL } from 'node:url';
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
// imported by tests or other modules. Compare both sides as file URLs: convert
// argv[1] with pathToFileURL so the check is robust even when the entry point is
// reached through a bin symlink (where argv[1] and import.meta.url differ).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
