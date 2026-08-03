import { log } from './logger.js';
import { startTelemetry } from './telemetry/index.js';

/**
 * Telemetry preload hook.
 *
 * Loaded via Node's `--import` before the application modules so the OTEL
 * auto-instrumentation can patch `node:http` and global `fetch` (undici) before
 * they are first required. Mirrors `packages/server/src/bootstrap-telemetry.ts`.
 */
try {
  await startTelemetry();
} catch (error) {
  log('error', 'OpenTelemetry bootstrap failed.', { error: String(error) });
  process.exit(1);
}
