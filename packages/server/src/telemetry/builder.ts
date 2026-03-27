import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK, resources, tracing } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_NAMESPACE } from '@opentelemetry/semantic-conventions';
import { env } from '../environment.js';

const ATTR_DEPLOYMENT_ENVIRONMENT_NAME = 'deployment.environment.name';
const HEALTH_CHECK_PATHS = new Set(['/health', '/ready', '/readiness']);

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

function normalizeTracesEndpoint(url: string): string {
  const parsed = new URL(url);
  if (!parsed.pathname || parsed.pathname === '/') {
    parsed.pathname = '/v1/traces';
  }
  return parsed.href;
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
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: otel.deploymentEnv,
  });

  const traceExporter = new OTLPTraceExporter({
    url: otel.exporterEndpoint ? normalizeTracesEndpoint(otel.exporterEndpoint) : undefined,
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
        '@opentelemetry/instrumentation-graphql': {
          enabled: true,
        },
      }),
    ],
  });
}
