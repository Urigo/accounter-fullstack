import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK, resources, tracing } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { env } from '../config/env.js';
import { getServiceVersion } from '../version.js';

/**
 * OpenTelemetry SDK builder for the MCP server.
 *
 * Mirrors `packages/server/src/telemetry/builder.ts` so both services export to
 * the same Grafana Tempo backend with identical conventions. Tracing relies on
 * auto-instrumentation:
 *  - `instrumentation-http` produces the incoming `POST /mcp` server span.
 *  - `instrumentation-undici` instruments global `fetch` (used by the upstream
 *    GraphQL client) and injects the W3C `traceparent` header, so the upstream
 *    Accounter server continues the SAME distributed trace.
 *
 * There is no GraphQL/Postgres layer in this process, so those instrumentations
 * stay off.
 */

const ATTR_DEPLOYMENT_ENVIRONMENT_NAME = 'deployment.environment.name';
// Endpoints that must never generate spans (liveness/metrics scrapes).
const HEALTH_CHECK_PATHS = new Set(['/health', '/metrics']);

function shouldIgnoreIncomingRequest(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    return HEALTH_CHECK_PATHS.has(pathname);
  } catch {
    const pathname = url.split('?')[0] ?? '';
    return HEALTH_CHECK_PATHS.has(pathname);
  }
}

/**
 * Parses an OTLP header string of the form "key1=value1,key2=value2" into a
 * Record<string, string>. Returns undefined when the input is absent or empty.
 */
function parseHeaders(headersStr: string | undefined): Record<string, string> | undefined {
  if (!headersStr) return undefined;
  const result: Record<string, string> = {};
  for (const part of headersStr.split(',')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const value = part.slice(eqIdx + 1).trim();
    if (key) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function buildSampler(
  samplerType:
    | 'always_on'
    | 'always_off'
    | 'parentbased_traceidratio'
    | 'traceidratio'
    | 'parentbased_always_on'
    | 'parentbased_always_off',
  arg: number | undefined,
) {
  switch (samplerType) {
    case 'always_off':
      return new tracing.AlwaysOffSampler();
    case 'parentbased_traceidratio': {
      const ratio = arg ?? 1.0;
      return new tracing.ParentBasedSampler({
        root: new tracing.TraceIdRatioBasedSampler(ratio),
      });
    }
    case 'traceidratio': {
      const ratio = arg ?? 1.0;
      return new tracing.TraceIdRatioBasedSampler(ratio);
    }
    case 'parentbased_always_on':
      return new tracing.ParentBasedSampler({
        root: new tracing.AlwaysOnSampler(),
      });
    case 'parentbased_always_off':
      return new tracing.ParentBasedSampler({
        root: new tracing.AlwaysOffSampler(),
      });
    default:
      return new tracing.AlwaysOnSampler();
  }
}

/**
 * Builds and returns a configured (but not yet started) NodeSDK instance using
 * the OTEL settings from `env`. Returns null when OTEL is disabled.
 */
export function buildOtelSdk(): NodeSDK | null {
  const otel = env.otel;

  if (!otel.enabled) {
    return null;
  }

  const resource = resources.resourceFromAttributes({
    [ATTR_SERVICE_NAME]: otel.serviceName,
    [ATTR_SERVICE_NAMESPACE]: otel.serviceNamespace,
    [ATTR_SERVICE_VERSION]: getServiceVersion(),
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: otel.deploymentEnv,
  });

  const traceExporter = new OTLPTraceExporter({
    url: otel.exporterEndpoint,
    headers: parseHeaders(otel.exporterHeaders),
  });

  const sampler = buildSampler(otel.tracesSampler, otel.tracesSamplerArg);

  return new NodeSDK({
    resource,
    traceExporter,
    sampler,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: request => shouldIgnoreIncomingRequest(request.url),
        },
        // This process has no GraphQL or Postgres layer of its own — only an
        // outbound GraphQL-over-HTTP client, covered by the undici (fetch)
        // instrumentation — so leave those server instrumentations off.
        '@opentelemetry/instrumentation-graphql': {
          enabled: false,
        },
      }),
    ],
  });
}
