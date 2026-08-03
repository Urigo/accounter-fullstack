import type { NodeSDK } from '@opentelemetry/sdk-node';
import { env } from '../config/env.js';
import { log } from '../logger.js';
import { buildOtelSdk } from './builder.js';

/**
 * Telemetry lifecycle for the MCP server.
 *
 * Mirrors `packages/server/src/telemetry/index.ts`: a single, idempotent,
 * concurrency-safe start (so `--import` preload and any defensive call converge
 * on one SDK) plus a graceful shutdown that flushes pending spans. When OTEL is
 * disabled the SDK is never built and both calls are no-ops.
 */

let sdk: NodeSDK | null = null;
let startPromise: Promise<void> | null = null;

export async function startTelemetry(): Promise<void> {
  if (sdk) {
    return;
  }

  if (startPromise) {
    await startPromise;
    return;
  }

  startPromise = (async () => {
    try {
      const builtSdk = buildOtelSdk();
      if (!builtSdk) {
        return;
      }

      await builtSdk.start();
      sdk = builtSdk;
    } catch (error) {
      sdk = null;

      if (env.otel.startupStrict) {
        throw error;
      }

      log('error', 'OpenTelemetry startup failed, continuing without tracing.', {
        error: String(error),
      });
    } finally {
      startPromise = null;
    }
  })();

  await startPromise;
}

export async function shutdownTelemetry(): Promise<void> {
  if (startPromise) {
    try {
      await startPromise;
    } catch {
      // Start failures leave no initialized SDK to shut down.
    }
  }

  if (!sdk) {
    return;
  }

  const currentSdk = sdk;
  sdk = null;

  try {
    await currentSdk.shutdown();
    log('info', 'OpenTelemetry shutdown completed.');
  } catch (error) {
    log('error', 'OpenTelemetry shutdown failed.', { error: String(error) });
  }
}
