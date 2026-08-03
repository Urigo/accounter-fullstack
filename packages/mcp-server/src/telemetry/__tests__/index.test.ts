import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({ config: vi.fn() }));

const mockOtelConfig = vi.hoisted(() => ({
  startupStrict: false,
}));

const mockBuildOtelSdk = vi.hoisted(() => vi.fn());
const mockLog = vi.hoisted(() => vi.fn());

vi.mock('../../config/env.js', () => ({
  env: { otel: mockOtelConfig },
}));

vi.mock('../../logger.js', () => ({
  log: mockLog,
}));

vi.mock('../builder.js', () => ({
  buildOtelSdk: mockBuildOtelSdk,
}));

type MockSdk = {
  start: ReturnType<typeof vi.fn>;
  shutdown: ReturnType<typeof vi.fn>;
};

function createMockSdk(): MockSdk {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('telemetry lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockOtelConfig.startupStrict = false;
  });

  describe('startTelemetry', () => {
    it('no-ops when the SDK is disabled (builder returns null)', async () => {
      mockBuildOtelSdk.mockReturnValueOnce(null);
      const { startTelemetry } = await import('../index.js');
      await expect(startTelemetry()).resolves.toBeUndefined();
    });

    it('throws startup errors in strict mode', async () => {
      mockOtelConfig.startupStrict = true;
      const sdk = createMockSdk();
      sdk.start.mockRejectedValueOnce(new Error('startup failed'));
      mockBuildOtelSdk.mockReturnValueOnce(sdk);

      const { startTelemetry } = await import('../index.js');
      await expect(startTelemetry()).rejects.toThrow('startup failed');
    });

    it('logs startup errors and continues in non-strict mode', async () => {
      const sdk = createMockSdk();
      sdk.start.mockRejectedValueOnce(new Error('startup failed'));
      mockBuildOtelSdk.mockReturnValueOnce(sdk);

      const { startTelemetry } = await import('../index.js');
      await expect(startTelemetry()).resolves.toBeUndefined();
      expect(mockLog).toHaveBeenCalledWith(
        'error',
        'OpenTelemetry startup failed, continuing without tracing.',
        expect.objectContaining({ error: expect.stringContaining('startup failed') }),
      );
    });

    it('reuses the same in-flight startup for concurrent calls', async () => {
      const startDeferred = createDeferred<void>();
      const sdk = createMockSdk();
      sdk.start.mockImplementationOnce(() => startDeferred.promise);
      mockBuildOtelSdk.mockReturnValue(sdk);

      const { startTelemetry } = await import('../index.js');
      const first = startTelemetry();
      const second = startTelemetry();

      expect(mockBuildOtelSdk).toHaveBeenCalledOnce();
      expect(sdk.start).toHaveBeenCalledOnce();

      startDeferred.resolve();
      await Promise.all([first, second]);
      await startTelemetry();

      expect(mockBuildOtelSdk).toHaveBeenCalledOnce();
    });
  });

  describe('shutdownTelemetry', () => {
    it('no-ops when telemetry was never started', async () => {
      const { shutdownTelemetry } = await import('../index.js');
      await expect(shutdownTelemetry()).resolves.toBeUndefined();
    });

    it('waits for an in-flight startup before shutting down the SDK', async () => {
      const startDeferred = createDeferred<void>();
      const sdk = createMockSdk();
      sdk.start.mockImplementationOnce(() => startDeferred.promise);
      mockBuildOtelSdk.mockReturnValueOnce(sdk);

      const { shutdownTelemetry, startTelemetry } = await import('../index.js');
      const start = startTelemetry();
      const shutdown = shutdownTelemetry();

      expect(sdk.shutdown).not.toHaveBeenCalled();
      startDeferred.resolve();
      await start;
      await shutdown;

      expect(sdk.shutdown).toHaveBeenCalledOnce();
    });

    it('logs shutdown success', async () => {
      const sdk = createMockSdk();
      mockBuildOtelSdk.mockReturnValueOnce(sdk);

      const { startTelemetry, shutdownTelemetry } = await import('../index.js');
      await startTelemetry();
      await shutdownTelemetry();

      expect(sdk.shutdown).toHaveBeenCalledOnce();
      expect(mockLog).toHaveBeenCalledWith('info', 'OpenTelemetry shutdown completed.');
    });

    it('logs shutdown failure without throwing', async () => {
      const sdk = createMockSdk();
      sdk.shutdown.mockRejectedValueOnce(new Error('shutdown failed'));
      mockBuildOtelSdk.mockReturnValueOnce(sdk);

      const { startTelemetry, shutdownTelemetry } = await import('../index.js');
      await startTelemetry();
      await expect(shutdownTelemetry()).resolves.toBeUndefined();

      expect(mockLog).toHaveBeenCalledWith(
        'error',
        'OpenTelemetry shutdown failed.',
        expect.objectContaining({ error: expect.stringContaining('shutdown failed') }),
      );
    });
  });
});
