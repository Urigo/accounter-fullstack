import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Canonical service name used in logs, health, and MCP server info. */
export const SERVICE_NAME = '@accounter/mcp-server';

let cachedVersion: string | undefined;

/**
 * Resolve the package version at runtime without importing outside `rootDir`.
 * Works from both `src/` (dev via tsx) and `dist/` (built), since each is one
 * level below the package root. The result is cached — the version cannot
 * change while the process runs, so we avoid a synchronous disk read on every
 * `/health` request.
 */
export function getServiceVersion(): string {
  if (cachedVersion !== undefined) {
    return cachedVersion;
  }
  try {
    const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    cachedVersion = parsed.version ?? '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}
