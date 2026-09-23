import { describe, expect, it } from 'vitest';
import { PromptCacheGate } from './prompt-cache-gate.helper.js';

const TTL_MS = 5 * 60 * 1000;
const SAFETY_MARGIN_MS = 60 * 1000;

type Controllable = {
  promise: Promise<string>;
  resolve: (v: string) => void;
  reject: (e: Error) => void;
};

function controllable(): Controllable {
  let resolve!: (v: string) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let queued microtasks drain so the gate's synchronous decisions have settled. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

function makeGate(overrides: { now?: () => number; maxWaitMs?: number } = {}) {
  return new PromptCacheGate({
    ttlMs: TTL_MS,
    maxWaitMs: overrides.maxWaitMs ?? 10_000,
    safetyMarginMs: SAFETY_MARGIN_MS,
    now: overrides.now,
  });
}

const cached = (): boolean => true;
const notCached = (): boolean => false;

describe('PromptCacheGate', () => {
  it('lets exactly one concurrent caller warm a cold prefix, and holds the rest back', async () => {
    const gate = makeGate();
    const pending: Controllable[] = [];
    const call = (): Promise<string> => {
      const c = controllable();
      pending.push(c);
      return c.promise;
    };

    const runs = [0, 1, 2, 3].map(() => gate.run('prefix', call, cached));
    await flush();

    // Only the elected warmer has issued a request; the other three are waiting
    // on it rather than each writing their own copy of the prefix.
    expect(pending).toHaveLength(1);

    pending[0]!.resolve('ok');
    await flush();

    // Released, the three waiters issue together as readers of what it wrote.
    expect(pending).toHaveLength(4);
    for (const p of pending.slice(1)) p.resolve('ok');
    const results = await Promise.all(runs);

    expect(results.map(r => r.gate)).toEqual(['warmed', 'waited', 'waited', 'waited']);
    expect(results.every(r => r.result === 'ok')).toBe(true);
  });

  it('does not make a caller wait once the prefix is known warm', async () => {
    let clock = 1_000_000;
    const gate = makeGate({ now: () => clock });

    await gate.run('prefix', () => Promise.resolve('first'), cached);

    const pending: Controllable[] = [];
    const call = (): Promise<string> => {
      const c = controllable();
      pending.push(c);
      return c.promise;
    };

    clock += 30_000; // still inside the TTL, minus the safety margin
    const runs = [gate.run('prefix', call, cached), gate.run('prefix', call, cached)];
    await flush();

    // Both issued straight away — no serialization once the entry is readable.
    expect(pending).toHaveLength(2);
    for (const p of pending) p.resolve('ok');
    expect((await Promise.all(runs)).map(r => r.gate)).toEqual(['warm', 'warm']);
  });

  it('treats the prefix as cold again once the TTL (less the safety margin) has passed', async () => {
    let clock = 1_000_000;
    const gate = makeGate({ now: () => clock });

    const first = await gate.run('prefix', () => Promise.resolve('a'), cached);
    expect(first.gate).toBe('warmed');

    clock += TTL_MS - SAFETY_MARGIN_MS + 1;
    const second = await gate.run('prefix', () => Promise.resolve('b'), cached);
    expect(second.gate).toBe('warmed');
  });

  it('releases the gate when the warming call throws, so the next caller is not deadlocked', async () => {
    const gate = makeGate();
    const warmer = controllable();

    const failing = gate.run('prefix', () => warmer.promise, cached);
    await flush();

    const waiterStarted: string[] = [];
    const waiting = gate.run(
      'prefix',
      () => {
        waiterStarted.push('started');
        return Promise.resolve('second');
      },
      cached,
    );
    await flush();
    expect(waiterStarted).toHaveLength(0);

    warmer.reject(new Error('extraction failed'));
    await expect(failing).rejects.toThrow('extraction failed');

    const result = await waiting;
    expect(waiterStarted).toHaveLength(1);
    expect(result.result).toBe('second');
  });

  it('lets waiters through when the warming call outlives maxWaitMs', async () => {
    const gate = makeGate({ maxWaitMs: 20 });
    const warmer = controllable();

    const slow = gate.run('prefix', () => warmer.promise, cached);
    await flush();

    // The warmer never responds within the budget; the waiter proceeds anyway and
    // pays its own cache write rather than stalling an upstream request deadline.
    const waiter = await gate.run('prefix', () => Promise.resolve('second'), cached);
    expect(waiter.gate).toBe('waited');
    expect(waiter.result).toBe('second');

    warmer.resolve('first');
    await slow;
  });

  it('never shares a gate between two different prefixes', async () => {
    const gate = makeGate();
    const pending: Controllable[] = [];
    const call = (): Promise<string> => {
      const c = controllable();
      pending.push(c);
      return c.promise;
    };

    const runs = [gate.run('catalog-a', call, cached), gate.run('catalog-b', call, cached)];
    await flush();

    // Distinct prefixes are distinct cache entries upstream, so neither can read
    // what the other writes and neither should wait on it.
    expect(pending).toHaveLength(2);
    for (const p of pending) p.resolve('ok');
    expect((await Promise.all(runs)).map(r => r.gate)).toEqual(['warmed', 'warmed']);
  });

  it('stops gating a prefix that reports no cache activity at all', async () => {
    const gate = makeGate();

    // A prefix below the model's minimum cacheable length: the breakpoint is a
    // silent no-op, so gating it would serialize a batch for nothing.
    const first = await gate.run('tiny', () => Promise.resolve('a'), notCached);
    expect(first.gate).toBe('warmed');

    const pending: Controllable[] = [];
    const call = (): Promise<string> => {
      const c = controllable();
      pending.push(c);
      return c.promise;
    };

    const runs = [gate.run('tiny', call, notCached), gate.run('tiny', call, notCached)];
    await flush();

    expect(pending).toHaveLength(2);
    for (const p of pending) p.resolve('ok');
    expect((await Promise.all(runs)).map(r => r.gate)).toEqual(['uncacheable', 'uncacheable']);
  });
});
