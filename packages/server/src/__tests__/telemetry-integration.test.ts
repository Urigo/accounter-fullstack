import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSdkStart = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSdkShutdown = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const MockNodeSDK = vi.hoisted(() =>
  vi.fn().mockImplementation(function () {
    return {
      start: mockSdkStart,
      shutdown: mockSdkShutdown,
    };
  }),
);

const mockResourceFromAttributes = vi.hoisted(() => vi.fn().mockReturnValue({}));
const mockGetNodeAutoInstrumentations = vi.hoisted(() => vi.fn().mockReturnValue({}));

const mockSamplers = vi.hoisted(() => ({
  AlwaysOnSampler: vi.fn().mockImplementation(function () {
    return { _type: 'AlwaysOnSampler' };
  }),
  AlwaysOffSampler: vi.fn().mockImplementation(function () {
    return { _type: 'AlwaysOffSampler' };
  }),
  ParentBasedSampler: vi.fn().mockImplementation(function () {
    return { _type: 'ParentBasedSampler' };
  }),
  TraceIdRatioBasedSampler: vi.fn().mockImplementation(function () {
    return { _type: 'TraceIdRatioBasedSampler' };
  }),
}));

const MockOTLPTraceExporter = vi.hoisted(() =>
  vi.fn().mockImplementation(function () {
    return {};
  }),
);

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: MockNodeSDK,
  tracing: mockSamplers,
  resources: {
    resourceFromAttributes: mockResourceFromAttributes,
  },
}));

vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: mockGetNodeAutoInstrumentations,
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: MockOTLPTraceExporter,
}));

const OTEL_ENV_KEYS = [
  'OTEL_ENABLED',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_SERVICE_NAME',
  'OTEL_SERVICE_NAMESPACE',
  'OTEL_DEPLOYMENT_ENV',
  'OTEL_TRACES_SAMPLER',
  'OTEL_TRACES_SAMPLER_ARG',
  'OTEL_STARTUP_STRICT',
] as const;

const originalOtelEnv = OTEL_ENV_KEYS.reduce(
  (acc, key) => {
    acc[key] = process.env[key];
    return acc;
  },
  {} as Record<(typeof OTEL_ENV_KEYS)[number], string | undefined>,
);

describe('telemetry integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    process.env.OTEL_ENABLED = '1';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318/v1/traces';
    process.env.OTEL_SERVICE_NAME = 'accounter-server-test';
    process.env.OTEL_SERVICE_NAMESPACE = 'accounter';
    process.env.OTEL_DEPLOYMENT_ENV = 'test';
    process.env.OTEL_TRACES_SAMPLER = 'always_on';
    process.env.OTEL_TRACES_SAMPLER_ARG = '';
    process.env.OTEL_STARTUP_STRICT = 'true';
  });

  afterEach(async () => {
    try {
      const { shutdownTelemetry } = await import('../telemetry/index.js');
      await shutdownTelemetry();
    } catch {
      // Ignore cleanup failures in tests that never started telemetry.
    }

    for (const key of OTEL_ENV_KEYS) {
      const originalValue = originalOtelEnv[key];
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
  });

  it('calls NodeSDK.start when telemetry is enabled with valid env', async () => {
    const { startTelemetry } = await import('../telemetry/index.js');

    await startTelemetry();

    expect(MockNodeSDK).toHaveBeenCalledOnce();
    expect(mockSdkStart).toHaveBeenCalledOnce();
  });

  it('starts telemetry only once when startTelemetry is called twice', async () => {
    const { startTelemetry } = await import('../telemetry/index.js');

    await startTelemetry();
    await startTelemetry();

    expect(MockNodeSDK).toHaveBeenCalledOnce();
    expect(mockSdkStart).toHaveBeenCalledOnce();
  });
});
