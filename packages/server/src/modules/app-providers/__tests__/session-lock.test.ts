import { describe, expect, it } from 'vitest';
import { SessionLock } from '../session-lock.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('SessionLock', () => {
  it('lets shared holders in together', async () => {
    const lock = new SessionLock();
    const first = await lock.acquireShared();
    const second = await lock.acquireShared();
    first();
    second();
  });

  it('keeps an exclusive holder waiting until every shared holder is out', async () => {
    const lock = new SessionLock();
    const releaseA = await lock.acquireShared();
    const releaseB = await lock.acquireShared();
    let exclusive = false;
    const waiting = lock.acquire().then(release => {
      exclusive = true;
      return release;
    });

    releaseA();
    await settle();
    expect(exclusive).toBe(false);
    releaseB();
    (await waiting)();
    expect(exclusive).toBe(true);
  });

  it('serves waiters in order, so later shared holders queue behind a waiting exclusive one', async () => {
    const lock = new SessionLock();
    const order: string[] = [];
    const releaseFirst = await lock.acquireShared();
    const exclusive = lock.acquire().then(release => {
      order.push('exclusive');
      return release;
    });
    const laterShared = lock.acquireShared().then(release => {
      order.push('later shared');
      return release;
    });
    await settle();
    expect(order).toEqual([]);

    releaseFirst();
    (await exclusive)();
    (await laterShared)();
    expect(order).toEqual(['exclusive', 'later shared']);
  });

  it('ignores a second release', async () => {
    const lock = new SessionLock();
    const release = await lock.acquireShared();
    release();
    release();
    const exclusive = await lock.acquire();
    let shared = false;
    void lock.acquireShared().then(() => {
      shared = true;
    });
    await settle();
    expect(shared).toBe(false);
    exclusive();
  });

  it('releases after a run that throws', async () => {
    const lock = new SessionLock();
    await expect(
      lock.runExclusive(() => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(lock.runShared(() => 'free')).resolves.toBe('free');
  });
});
