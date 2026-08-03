import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { buildOtelSdk } from '../builder.js';

// Prevent dotenv from loading any .env file during tests.
vi.mock('dotenv', () => ({ config: vi.fn() }));

// ---------- Mutable env stub ----------
const mockOtelConfig = vi.hoisted(() => ({
  enabled: false,
  serviceName: 'test-mcp',
  serviceNamespace: 'test-ns',
  deploymentEnv: 'test-env',
  exporterEndpoint: undefined as string | undefined,
  exporterHeaders: undefined as string | undefined,
  tracesSampler: 'always_on' as 'always_on' | 'always_off' | 'parentbased_traceidratio',
  tracesSamplerArg: undefined as number | undefined,
  startupStrict: false,
}));

vi.mock('../../config/env.js', () => ({
  env: { otel: mockOtelConfig },
}));

vi.mock('../../version.js', () => ({
  SERVICE_NAME: '@accounter/mcp-server',
  getServiceVersion: () => '1.2.3',
}));

// ---------- NodeSDK + tracing mock ----------
const MockNodeSDK = vi.hoisted(() =>
  vi.fn().mockImplementation(function () {
    return { start: vi.fn(), shutdown: vi.fn() };
  }),
);

const mockSamplers = vi.hoisted(() => ({
  AlwaysOnSampler: vi.fn().mockImplementation(function () {
    return { _type: 'AlwaysOnSampler' };
  }),
  AlwaysOffSampler: vi.fn().mockImplementation(function () {
    return { _type: 'AlwaysOffSampler' };
  }),
  ParentBasedSampler: vi.fn().mockImplementation(function (config: unknown) {
    return { _type: 'ParentBasedSampler', _config: config };
  }),
  TraceIdRatioBasedSampler: vi.fn().mockImplementation(function (ratio: number) {
    return { _type: 'TraceIdRatioBasedSampler', _ratio: ratio };
  }),
}));

const mockResource = vi.hoisted(() => ({ _type: 'resource' }));
const mockResourceFromAttributes = vi.hoisted(() => vi.fn().mockReturnValue(mockResource));

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: MockNodeSDK,
  tracing: mockSamplers,
  resources: {
    resourceFromAttributes: mockResourceFromAttributes,
  },
}));

// ---------- OTLPTraceExporter mock ----------
const MockOTLPTraceExporter = vi.hoisted(() =>
  vi.fn().mockImplementation(function (config: unknown) {
    return { _exporterConfig: config };
  }),
);

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: MockOTLPTraceExporter,
}));

// ---------- auto-instrumentations mock ----------
const mockInstrumentationBundle = vi.hoisted(() => ({}));
vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn().mockReturnValue(mockInstrumentationBundle),
}));

describe('buildOtelSdk', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockOtelConfig.enabled = false;
    mockOtelConfig.serviceName = 'test-mcp';
    mockOtelConfig.serviceNamespace = 'test-ns';
    mockOtelConfig.deploymentEnv = 'test-env';
    mockOtelConfig.exporterEndpoint = undefined;
    mockOtelConfig.exporterHeaders = undefined;
    mockOtelConfig.tracesSampler = 'always_on';
    mockOtelConfig.tracesSamplerArg = undefined;

    mockResourceFromAttributes.mockReturnValue(mockResource);
  });

  describe('when OTEL is disabled', () => {
    it('returns null and constructs nothing', () => {
      expect(buildOtelSdk()).toBeNull();
      expect(MockNodeSDK).not.toHaveBeenCalled();
      expect(MockOTLPTraceExporter).not.toHaveBeenCalled();
    });
  });

  describe('when OTEL is enabled', () => {
    beforeEach(() => {
      mockOtelConfig.enabled = true;
      mockOtelConfig.exporterEndpoint = 'http://localhost:4318/v1/traces';
    });

    it('returns a NodeSDK instance', () => {
      expect(buildOtelSdk()).not.toBeNull();
      expect(MockNodeSDK).toHaveBeenCalledOnce();
    });

    it('builds resource with service identity including version', () => {
      buildOtelSdk();
      expect(mockResourceFromAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'service.name': 'test-mcp',
          'service.namespace': 'test-ns',
          'service.version': '1.2.3',
          'deployment.environment.name': 'test-env',
        }),
      );
    });

    it('configures OTLPTraceExporter with the endpoint', () => {
      buildOtelSdk();
      expect(MockOTLPTraceExporter).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://localhost:4318/v1/traces' }),
      );
    });

    it('disables graphql instrumentation (no GraphQL layer in this process)', () => {
      buildOtelSdk();
      expect(getNodeAutoInstrumentations).toHaveBeenCalledWith(
        expect.objectContaining({
          '@opentelemetry/instrumentation-fs': expect.objectContaining({ enabled: false }),
          '@opentelemetry/instrumentation-http': expect.objectContaining({
            ignoreIncomingRequestHook: expect.any(Function),
          }),
          '@opentelemetry/instrumentation-graphql': expect.objectContaining({ enabled: false }),
        }),
      );
    });

    describe('sampler configuration', () => {
      it('uses AlwaysOnSampler for always_on', () => {
        mockOtelConfig.tracesSampler = 'always_on';
        buildOtelSdk();
        expect(mockSamplers.AlwaysOnSampler).toHaveBeenCalledOnce();
      });

      it('uses AlwaysOffSampler for always_off', () => {
        mockOtelConfig.tracesSampler = 'always_off';
        buildOtelSdk();
        expect(mockSamplers.AlwaysOffSampler).toHaveBeenCalledOnce();
      });

      it('wraps TraceIdRatioBasedSampler in ParentBasedSampler for parentbased_traceidratio', () => {
        mockOtelConfig.tracesSampler = 'parentbased_traceidratio';
        mockOtelConfig.tracesSamplerArg = 0.5;
        buildOtelSdk();
        expect(mockSamplers.TraceIdRatioBasedSampler).toHaveBeenCalledWith(0.5);
        expect(mockSamplers.ParentBasedSampler).toHaveBeenCalledOnce();
      });
    });

    describe('headers configuration', () => {
      it('parses key=value pairs into a headers record', () => {
        mockOtelConfig.exporterHeaders = 'Authorization=Bearer token,X-Custom=value';
        buildOtelSdk();
        expect(MockOTLPTraceExporter).toHaveBeenCalledWith(
          expect.objectContaining({
            headers: { Authorization: 'Bearer token', 'X-Custom': 'value' },
          }),
        );
      });

      it('passes undefined headers when unset', () => {
        mockOtelConfig.exporterHeaders = undefined;
        buildOtelSdk();
        expect(MockOTLPTraceExporter).toHaveBeenCalledWith(
          expect.objectContaining({ headers: undefined }),
        );
      });
    });
  });
});
