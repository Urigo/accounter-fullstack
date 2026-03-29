import type { NodeSDK } from '@opentelemetry/sdk-node';
import { env } from '../environment.js';
import { buildOtelSdk } from './builder.js';

let sdk: NodeSDK | null = null;
let startPromise: Promise<void> | null = null;

export async function startTelemetry() {
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

      console.error('OpenTelemetry startup failed, continuing without tracing.', error);
    } finally {
      startPromise = null;
    }
  })();

  await startPromise;
}

export async function shutdownTelemetry() {
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
    console.info('OpenTelemetry shutdown completed.');
  } catch (error) {
    console.error('OpenTelemetry shutdown failed.', error);
  }
}
