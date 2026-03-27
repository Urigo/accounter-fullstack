import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({ config: vi.fn() }));

const mockOtelConfig = vi.hoisted(() => ({
  startupStrict: false,
}));

const mockBuildOtelSdk = vi.hoisted(() => vi.fn());

vi.mock('../../environment.js', () => ({
  env: { otel: mockOtelConfig },
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
    it('throws startup errors in strict mode', async () => {
      mockOtelConfig.startupStrict = true;

      const sdk = createMockSdk();
      const startupError = new Error('startup failed');
      sdk.start.mockRejectedValueOnce(startupError);
      mockBuildOtelSdk.mockReturnValueOnce(sdk);

      const { startTelemetry } = await import('../index.js');

      await expect(startTelemetry()).rejects.toThrow('startup failed');
    });

    it('logs startup errors and continues in non-strict mode', async () => {
      const sdk = createMockSdk();
      const startupError = new Error('startup failed');
      sdk.start.mockRejectedValueOnce(startupError);
      mockBuildOtelSdk.mockReturnValueOnce(sdk);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const { startTelemetry } = await import('../index.js');

      await expect(startTelemetry()).resolves.toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'OpenTelemetry startup failed, continuing without tracing.',
        startupError,
      );

      consoleErrorSpy.mockRestore();
    });

    it('reuses the same in-flight startup for concurrent startTelemetry calls', async () => {
      const startDeferred = createDeferred<void>();
      const sdk = createMockSdk();
      sdk.start.mockImplementationOnce(() => startDeferred.promise);
      mockBuildOtelSdk.mockReturnValue(sdk);

      const { startTelemetry } = await import('../index.js');

      const firstStart = startTelemetry();
      const secondStart = startTelemetry();

      expect(mockBuildOtelSdk).toHaveBeenCalledOnce();
      expect(sdk.start).toHaveBeenCalledOnce();

      startDeferred.resolve();

      await Promise.all([firstStart, secondStart]);
      await startTelemetry();

      expect(mockBuildOtelSdk).toHaveBeenCalledOnce();
    });

    it('clears the in-flight startup lock after a strict startup failure so later calls can retry', async () => {
      mockOtelConfig.startupStrict = true;

      const startupError = new Error('startup failed');
      const failingSdk = createMockSdk();
      failingSdk.start.mockRejectedValueOnce(startupError);

      const succeedingSdk = createMockSdk();

      mockBuildOtelSdk.mockReturnValueOnce(failingSdk).mockReturnValueOnce(succeedingSdk);

      const { startTelemetry } = await import('../index.js');

      await expect(Promise.all([startTelemetry(), startTelemetry()])).rejects.toThrow(startupError);
      expect(mockBuildOtelSdk).toHaveBeenCalledOnce();

      await expect(startTelemetry()).resolves.toBeUndefined();
      expect(mockBuildOtelSdk).toHaveBeenCalledTimes(2);
      expect(succeedingSdk.start).toHaveBeenCalledOnce();
    });
  });

  describe('shutdownTelemetry', () => {
    it('waits for an in-flight startup before shutting down the SDK', async () => {
      const startDeferred = createDeferred<void>();
      const sdk = createMockSdk();
      sdk.start.mockImplementationOnce(() => startDeferred.promise);
      mockBuildOtelSdk.mockReturnValueOnce(sdk);

      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

      const { shutdownTelemetry, startTelemetry } = await import('../index.js');

      const start = startTelemetry();
      const shutdown = shutdownTelemetry();

      expect(sdk.shutdown).not.toHaveBeenCalled();

      startDeferred.resolve();

      await start;
      await shutdown;

      expect(sdk.shutdown).toHaveBeenCalledOnce();

      consoleInfoSpy.mockRestore();
    });

    it('logs shutdown success when sdk shutdown resolves', async () => {
      const sdk = createMockSdk();
      mockBuildOtelSdk.mockReturnValueOnce(sdk);

      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

      const { startTelemetry, shutdownTelemetry } = await import('../index.js');

      await startTelemetry();
      await shutdownTelemetry();

      expect(sdk.shutdown).toHaveBeenCalledOnce();
      expect(consoleInfoSpy).toHaveBeenCalledWith('OpenTelemetry shutdown completed.');

      consoleInfoSpy.mockRestore();
    });

    it('logs shutdown failure when sdk shutdown rejects', async () => {
      const sdk = createMockSdk();
      const shutdownError = new Error('shutdown failed');
      sdk.shutdown.mockRejectedValueOnce(shutdownError);
      mockBuildOtelSdk.mockReturnValueOnce(sdk);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const { startTelemetry, shutdownTelemetry } = await import('../index.js');

      await startTelemetry();
      await expect(shutdownTelemetry()).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith('OpenTelemetry shutdown failed.', shutdownError);

      consoleErrorSpy.mockRestore();
    });
  });
});
