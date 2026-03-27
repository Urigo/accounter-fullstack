import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { buildOtelSdk } from '../builder.js';

// Prevent dotenv from loading any .env file during tests
vi.mock('dotenv', () => ({ config: vi.fn() }));

// ---------- Mutable env stub ----------
// vi.hoisted ensures this object exists before vi.mock factories run (hoisting order).
const mockOtelConfig = vi.hoisted(() => ({
  enabled: false,
  serviceName: 'test-service',
  serviceNamespace: 'test-ns',
  deploymentEnv: 'test-env',
  exporterEndpoint: undefined as string | undefined,
  exporterHeaders: undefined as string | undefined,
  tracesSampler: 'always_on' as 'always_on' | 'always_off' | 'parentbased_traceidratio',
  tracesSamplerArg: undefined as number | undefined,
  startupStrict: false,
}));

vi.mock('../../environment.js', () => ({
  env: { otel: mockOtelConfig },
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

// -------------------------------------------------------
// Tests
// -------------------------------------------------------
describe('buildOtelSdk', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset to a known disabled baseline before each test
    mockOtelConfig.enabled = false;
    mockOtelConfig.serviceName = 'test-service';
    mockOtelConfig.serviceNamespace = 'test-ns';
    mockOtelConfig.deploymentEnv = 'test-env';
    mockOtelConfig.exporterEndpoint = undefined;
    mockOtelConfig.exporterHeaders = undefined;
    mockOtelConfig.tracesSampler = 'always_on';
    mockOtelConfig.tracesSamplerArg = undefined;

    // Restore mock return values cleared by clearAllMocks
    mockResourceFromAttributes.mockReturnValue(mockResource);
  });

  // ---- disabled path ----

  describe('when OTEL is disabled', () => {
    it('returns null', () => {
      mockOtelConfig.enabled = false;
      expect(buildOtelSdk()).toBeNull();
    });

    it('does not construct NodeSDK', () => {
      mockOtelConfig.enabled = false;
      buildOtelSdk();
      expect(MockNodeSDK).not.toHaveBeenCalled();
    });

    it('does not construct OTLPTraceExporter', () => {
      mockOtelConfig.enabled = false;
      buildOtelSdk();
      expect(MockOTLPTraceExporter).not.toHaveBeenCalled();
    });
  });

  // ---- enabled path ----

  describe('when OTEL is enabled', () => {
    beforeEach(() => {
      mockOtelConfig.enabled = true;
      mockOtelConfig.exporterEndpoint = 'http://localhost:4318';
    });

    it('returns a NodeSDK instance', () => {
      const result = buildOtelSdk();
      expect(result).not.toBeNull();
      expect(MockNodeSDK).toHaveBeenCalledOnce();
    });

    it('builds resource with correct service attributes', () => {
      buildOtelSdk();

      expect(mockResourceFromAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'service.name': 'test-service',
          'service.namespace': 'test-ns',
          'deployment.environment.name': 'test-env',
        }),
      );
    });

    it('passes the built resource to NodeSDK', () => {
      buildOtelSdk();

      const [sdkConfig] = MockNodeSDK.mock.calls[0];
      expect(sdkConfig.resource).toBe(mockResource);
    });

    it('configures OTLPTraceExporter with the endpoint', () => {
      buildOtelSdk();

      expect(MockOTLPTraceExporter).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://localhost:4318/v1/traces' }),
      );
    });

    it('passes the OTLPTraceExporter instance to NodeSDK', () => {
      buildOtelSdk();

      const [sdkConfig] = MockNodeSDK.mock.calls[0];
      expect(sdkConfig.traceExporter).toBeDefined();
    });

    it('includes auto-instrumentations in NodeSDK config', () => {
      buildOtelSdk();

      const [sdkConfig] = MockNodeSDK.mock.calls[0];
      expect(sdkConfig.instrumentations).toContain(mockInstrumentationBundle);
    });

    it('configures fs/http/graphql auto-instrumentations', () => {
      buildOtelSdk();

      expect(getNodeAutoInstrumentations).toHaveBeenCalledWith(
        expect.objectContaining({
          '@opentelemetry/instrumentation-fs': expect.objectContaining({
            enabled: false,
          }),
          '@opentelemetry/instrumentation-http': expect.objectContaining({
            ignoreIncomingRequestHook: expect.any(Function),
          }),
          '@opentelemetry/instrumentation-graphql': expect.objectContaining({
            enabled: true,
          }),
        }),
      );
    });

    // ---- sampler selection ----

    describe('sampler configuration', () => {
      it('uses AlwaysOnSampler for always_on', () => {
        mockOtelConfig.tracesSampler = 'always_on';
        buildOtelSdk();
        expect(mockSamplers.AlwaysOnSampler).toHaveBeenCalledOnce();
        expect(mockSamplers.AlwaysOffSampler).not.toHaveBeenCalled();
        expect(mockSamplers.ParentBasedSampler).not.toHaveBeenCalled();
      });

      it('uses AlwaysOffSampler for always_off', () => {
        mockOtelConfig.tracesSampler = 'always_off';
        buildOtelSdk();
        expect(mockSamplers.AlwaysOffSampler).toHaveBeenCalledOnce();
        expect(mockSamplers.AlwaysOnSampler).not.toHaveBeenCalled();
      });

      it('uses ParentBasedSampler wrapping TraceIdRatioBasedSampler for parentbased_traceidratio', () => {
        mockOtelConfig.tracesSampler = 'parentbased_traceidratio';
        mockOtelConfig.tracesSamplerArg = 0.5;
        buildOtelSdk();

        expect(mockSamplers.TraceIdRatioBasedSampler).toHaveBeenCalledWith(0.5);
        expect(mockSamplers.ParentBasedSampler).toHaveBeenCalledOnce();
      });

      it('defaults ratio to 1.0 when parentbased_traceidratio arg is absent', () => {
        mockOtelConfig.tracesSampler = 'parentbased_traceidratio';
        mockOtelConfig.tracesSamplerArg = undefined;
        buildOtelSdk();

        expect(mockSamplers.TraceIdRatioBasedSampler).toHaveBeenCalledWith(1.0);
      });

      it('passes the sampler to NodeSDK', () => {
        mockOtelConfig.tracesSampler = 'always_on';
        buildOtelSdk();

        const [sdkConfig] = MockNodeSDK.mock.calls[0];
        expect(sdkConfig.sampler).toBeDefined();
      });
    });

    // ---- header parsing ----

    describe('headers configuration', () => {
      it('parses key=value pairs and passes them to OTLPTraceExporter', () => {
        mockOtelConfig.exporterHeaders = 'Authorization=Bearer token,X-Custom=value';
        buildOtelSdk();

        expect(MockOTLPTraceExporter).toHaveBeenCalledWith(
          expect.objectContaining({
            headers: {
              Authorization: 'Bearer token',
              'X-Custom': 'value',
            },
          }),
        );
      });

      it('passes undefined headers when exporterHeaders is not configured', () => {
        mockOtelConfig.exporterHeaders = undefined;
        buildOtelSdk();

        expect(MockOTLPTraceExporter).toHaveBeenCalledWith(
          expect.objectContaining({ headers: undefined }),
        );
      });
    });
  });
});
