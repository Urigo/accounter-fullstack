import { describe, expect, it } from 'vitest';
import { allSettledOrThrow } from '../promises.js';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('allSettledOrThrow', () => {
  it('resolves with the values in input order', async () => {
    const slow = deferred<number>();
    const result = allSettledOrThrow([slow.promise, Promise.resolve('b'), 3]);
    slow.resolve(1);

    await expect(result).resolves.toEqual([1, 'b', 3]);
  });

  it('does not reject until a slower sibling has settled', async () => {
    const slow = deferred();
    let settled = false;
    const result = allSettledOrThrow([Promise.reject(new Error('boom')), slow.promise]).finally(
      () => {
        settled = true;
      },
    );

    await new Promise(resolve => setTimeout(resolve, 10));
    // Promise.all would have rejected here, leaving the sibling running.
    expect(settled).toBe(false);

    slow.resolve();
    await expect(result).rejects.toThrow('boom');
  });

  it('rethrows the first rejection in input order', async () => {
    const later = deferred();
    const first = later.promise.then(() => {
      throw new Error('first');
    });
    const result = allSettledOrThrow([first, Promise.reject(new Error('second'))]);
    later.resolve();

    await expect(result).rejects.toThrow('first');
  });
});
