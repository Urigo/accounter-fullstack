type Waiter = { exclusive: boolean; grant: () => void };

/**
 * A shared/exclusive lock over a request's database session.
 *
 * Reads hold it shared, so independent reads can be in flight on the connection at once (it runs in
 * pipeline mode). Everything that changes the session's state — opening or closing the
 * transaction, a write that is committed right away, an explicit `transaction()` scope, disposal —
 * holds it exclusively, waiting for the reads in flight to finish first.
 *
 * Waiters are served in arrival order: a waiting exclusive holder blocks shared holders that arrive
 * after it, so a stream of reads cannot starve a write.
 */
export class SessionLock {
  private sharedHolders = 0;
  private exclusiveHeld = false;
  private readonly waiters: Waiter[] = [];

  /** Waits for exclusive access; the returned function releases it. */
  public acquire(): Promise<() => void> {
    return this.enqueue(true);
  }

  /** Waits for shared access; the returned function releases it. */
  public acquireShared(): Promise<() => void> {
    return this.enqueue(false);
  }

  public async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  public async runShared<T>(fn: () => Promise<T> | T): Promise<T> {
    const release = await this.acquireShared();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private enqueue(exclusive: boolean): Promise<() => void> {
    return new Promise(resolve => {
      this.waiters.push({ exclusive, grant: () => resolve(this.releaser(exclusive)) });
      this.dispatch();
    });
  }

  private releaser(exclusive: boolean): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (exclusive) {
        this.exclusiveHeld = false;
      } else {
        this.sharedHolders--;
      }
      this.dispatch();
    };
  }

  private dispatch(): void {
    while (this.waiters.length > 0 && !this.exclusiveHeld) {
      const next = this.waiters[0]!;
      if (next.exclusive) {
        if (this.sharedHolders > 0) return;
        this.waiters.shift();
        this.exclusiveHeld = true;
        next.grant();
        return;
      }
      this.waiters.shift();
      this.sharedHolders++;
      next.grant();
    }
  }
}
