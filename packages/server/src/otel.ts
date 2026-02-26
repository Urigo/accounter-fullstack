import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import type { env } from './environment.js';

let sdk: NodeSDK | undefined;

export function initOtel(otelConfig: typeof env.otel): void {
  // Early return if OTEL is not enabled
  if (!otelConfig?.enabled) {
    return;
  }

  // Create the OpenTelemetry SDK with console exporter
  sdk = new NodeSDK({
    serviceName: otelConfig.serviceName,
    traceExporter: new ConsoleSpanExporter(),
    instrumentations: [
      // Auto-instrument PostgreSQL queries
      new PgInstrumentation({
        enhancedDatabaseReporting: false, // Set to true to include query text and parameters in spans (use with caution in production)
      }),
      // Auto-instrument HTTP requests
      new HttpInstrumentation({
        ignoreIncomingRequestHook: request => {
          // Optionally filter out health check endpoints
          const url = request.url || '';
          return url.includes('/health') || url.includes('/readiness');
        },
      }),
    ],
  });

  // Start the SDK
  sdk.start();
}

/**
 * Gracefully shut down the OpenTelemetry SDK.
 * Should be called during application shutdown to flush pending telemetry.
 */
export async function shutdownOtel(): Promise<void> {
  if (!sdk) {
    return;
  }

  try {
    await sdk.shutdown();
    process.stdout.write('[otel] OpenTelemetry SDK shut down successfully\n');
  } catch (error) {
    process.stderr.write(`[otel] Error shutting down OpenTelemetry SDK: ${error}\n`);
  }
}
