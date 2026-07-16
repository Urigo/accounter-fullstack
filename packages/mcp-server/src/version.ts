import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Canonical service name used in logs, health, and MCP server info. */
export const SERVICE_NAME = '@accounter/mcp-server';

/**
 * Resolve the package version at runtime without importing outside `rootDir`.
 * Works from both `src/` (dev via tsx) and `dist/` (built), since each is one
 * level below the package root.
 */
export function getServiceVersion(): string {
  try {
    const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    return parsed.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
