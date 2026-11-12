import { parse } from 'graphql';
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

    expect(context.dbRequest?.clientsToDispose).toEqual([]);
  });

  it('disposes clients when the client cancels the request mid-execution', async () => {
    // The leak this guards against: urql aborts the in-flight query on every
    // keystroke, so execution never completes and `onExecuteDone` never fires.
    const controller = new AbortController();
    const context = buildContext(controller);
    onContextBuilding(context);

    const dispose = vi.fn().mockResolvedValue(undefined);
    context.dbRequest!.clientsToDispose.push({ dispose });

    controller.abort();

    await vi.waitFor(() => {
      expect(dispose).toHaveBeenCalledTimes(1);
      // Cleared so a later disposal pass cannot double-dispose.
      expect(context.dbRequest?.clientsToDispose).toEqual([]);
    });
  });

  it('defers disposal of a client whose operation is still running', async () => {
    // The caller hanging up does not stop the mutation this server is running.
    // A document upload that times out mid-OCR still has an INSERT ahead of it;
    // disposing here failed that write with "already disposed" and lost the work.
    const controller = new AbortController();
    const context = buildContext(controller);
    onContextBuilding(context);

    const dispose = vi.fn().mockResolvedValue(undefined);
    const disposeWhenIdle = vi.fn().mockResolvedValue(true); // deferred
    context.dbRequest!.clientsToDispose.push({ dispose, disposeWhenIdle });

    controller.abort();

    await vi.waitFor(() => {
      expect(disposeWhenIdle).toHaveBeenCalledTimes(1);
      // Still registered: it holds a connection the end-of-execution pass must release.
      expect(context.dbRequest?.clientsToDispose).toHaveLength(1);
    });
    expect(dispose).not.toHaveBeenCalled();
  });

  it('drops a client that disposed on the spot from the list', async () => {
    const controller = new AbortController();
    const context = buildContext(controller);
    onContextBuilding(context);

    const disposeWhenIdle = vi.fn().mockResolvedValue(false); // nothing in flight
    context.dbRequest!.clientsToDispose.push({
      dispose: vi.fn().mockResolvedValue(undefined),
      disposeWhenIdle,
    });

    controller.abort();

    await vi.waitFor(() => {
      expect(disposeWhenIdle).toHaveBeenCalledTimes(1);
      expect(context.dbRequest?.clientsToDispose).toEqual([]);
    });
  });

  it('keeps a client registered when its deferral fails', async () => {
    // A rejected deferral released nothing. Dropping the client here would
    // strand its checked-out connection with nothing left to release it.
    const controller = new AbortController();
    const context = buildContext(controller);
    onContextBuilding(context);

    const disposeWhenIdle = vi.fn().mockRejectedValue(new Error('boom'));
    context.dbRequest!.clientsToDispose.push({
      dispose: vi.fn().mockResolvedValue(undefined),
      disposeWhenIdle,
    });

    controller.abort();

    await vi.waitFor(() => {
      expect(disposeWhenIdle).toHaveBeenCalledTimes(1);
      expect(context.dbRequest?.clientsToDispose).toHaveLength(1);
    });
  });

  it('marks execution in flight, and clears it once execution is done', async () => {
    const context = buildContext(new AbortController());
    const plugin = dbCleanupPlugin();
    onContextBuilding(context);

    const dispose = vi.fn().mockResolvedValue(undefined);
    context.dbRequest!.clientsToDispose.push({ dispose });

    const hooks = plugin.onExecute!({ args: { contextValue: context } } as never) as {
      onExecuteDone: (payload: { result: unknown }) => Promise<void>;
    };
    // The window in which a DB client that has gone quiet belongs to a live
    // request rather than to a leak.
    expect(context.dbRequest?.executionInFlight).toBe(true);

    await hooks.onExecuteDone({ result: {} });

    expect(context.dbRequest?.executionInFlight).toBe(false);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes clients registered after the abort listener was attached', async () => {
    // Clients are constructed during execution, well after context building.
    const controller = new AbortController();
    const context = buildContext(controller);
    onContextBuilding(context);

    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);
    context.dbRequest!.clientsToDispose.push({ dispose: first }, { dispose: second });

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
    expect(context.dbRequest?.clientsToDispose).toEqual([]);
  });

  it('does not throw when the context carries no request signal', () => {
    const context = {} as AccounterContext;

    expect(() => onContextBuilding(context)).not.toThrow();
    expect(context.dbRequest?.clientsToDispose).toEqual([]);
  });

  it('gives every request an id for DB log lines', () => {
    const context = buildContext(new AbortController());

    onContextBuilding(context);

    expect(context.dbRequest?.requestId).toEqual(expect.any(String));
    expect(context.dbRequest?.requestId).not.toHaveLength(0);
  });

  it('records the operation name, from the request or from the document', () => {
    const plugin = dbCleanupPlugin();

    const named = buildContext(new AbortController());
    onContextBuilding(named);
    plugin.onExecute!({ args: { contextValue: named, operationName: 'VatReport' } } as never);
    expect(named.dbRequest?.operationName).toBe('VatReport');

    const fromDocument = buildContext(new AbortController());
    onContextBuilding(fromDocument);
    plugin.onExecute!({
      args: { contextValue: fromDocument, document: parse('query AllCharges { __typename }') },
    } as never);
    expect(fromDocument.dbRequest?.operationName).toBe('AllCharges');

    const anonymous = buildContext(new AbortController());
    onContextBuilding(anonymous);
    plugin.onExecute!({
      args: { contextValue: anonymous, document: parse('{ __typename }') },
    } as never);
    expect(anonymous.dbRequest?.operationName).toBe('anonymous');
  });

  it('marks the context once end-of-execution disposal has run, but not on abort', async () => {
    const controller = new AbortController();
    const context = buildContext(controller);
    const plugin = dbCleanupPlugin();
    onContextBuilding(context);

    const hooks = plugin.onExecute!({ args: { contextValue: context } } as never) as {
      onExecuteDone: (payload: { result: unknown }) => Promise<void>;
    };

    // An abort defers disposal; the end-of-execution pass still drains the list.
    controller.abort();
    await vi.waitFor(() => expect(context.dbRequest?.clientsToDispose).toEqual([]));
    expect(context.dbRequest?.disposed).toBe(false);

    await hooks.onExecuteDone({ result: {} });
    // From here on a newly constructed DB client must not hold a connection.
    expect(context.dbRequest?.disposed).toBe(true);
  });
});
