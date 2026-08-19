import { describe, expect, it, vi } from 'vitest';
import { dbCleanupPlugin } from '../db-cleanup-plugin.js';
import type { AccounterContext } from '../../shared/types/index.js';

type ContextBuildingArg = Parameters<
  NonNullable<ReturnType<typeof dbCleanupPlugin>['onContextBuilding']>
>[0];

/** Context carrying a real AbortController, as Yoga supplies per request. */
function buildContext(controller: AbortController) {
  return { request: { signal: controller.signal } } as unknown as AccounterContext;
}

function onContextBuilding(context: AccounterContext) {
  dbCleanupPlugin().onContextBuilding?.({ context } as unknown as ContextBuildingArg);
}

describe('dbCleanupPlugin', () => {
  it('initializes the disposal list', () => {
    const context = buildContext(new AbortController());

    onContextBuilding(context);

    expect(context.dbClientsToDispose).toEqual([]);
  });

  it('disposes clients when the client cancels the request mid-execution', async () => {
    // The leak this guards against: urql aborts the in-flight query on every
    // keystroke, so execution never completes and `onExecuteDone` never fires.
    const controller = new AbortController();
    const context = buildContext(controller);
    onContextBuilding(context);

    const dispose = vi.fn().mockResolvedValue(undefined);
    context.dbClientsToDispose!.push({ dispose });

    controller.abort();

    await vi.waitFor(() => {
      expect(dispose).toHaveBeenCalledTimes(1);
      // Cleared so a later disposal pass cannot double-dispose.
      expect(context.dbClientsToDispose).toEqual([]);
    });
  });

  it('disposes clients registered after the abort listener was attached', async () => {
    // Clients are constructed during execution, well after context building.
    const controller = new AbortController();
    const context = buildContext(controller);
    onContextBuilding(context);

    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);
    context.dbClientsToDispose!.push({ dispose: first }, { dispose: second });

    controller.abort();

    await vi.waitFor(() => {
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  it('handles a request that was already aborted before context building', () => {
    const controller = new AbortController();
    controller.abort();
    const context = buildContext(controller);

    // `addEventListener('abort')` never fires on an already-aborted signal, so
    // the plugin must handle this case explicitly rather than silently
    // attaching a listener that will never run.
    expect(() => onContextBuilding(context)).not.toThrow();
    expect(context.dbClientsToDispose).toEqual([]);
  });

  it('does not throw when the context carries no request signal', () => {
    const context = {} as AccounterContext;

    expect(() => onContextBuilding(context)).not.toThrow();
    expect(context.dbClientsToDispose).toEqual([]);
  });
});
