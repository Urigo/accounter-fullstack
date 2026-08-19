import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { Pool } from 'pg';
import { getTenantDbClientStats } from '../modules/app-providers/tenant-db-client.js';

const NS_PER_MS = 1e6;

export interface PoolMonitorOptions {
  pool: Pool;
  /** Emit a heartbeat this often. */
  intervalMs: number;
  /** Pool size, for saturation reporting. */
  max: number;
}

/**
 * Periodic health heartbeat for the Postgres pool.
 *
 * The failure this exists for is silent by construction: an exhausted pool
 * produces no error, no CPU, and no log line — requests simply queue in
 * `pool.connect()` forever. `waiting > 0` alongside `idle === 0` is that state,
 * visible in a single line, and the heartbeat continuing to print at all is
 * proof the event loop is still turning.
 */
export function startPoolMonitor({ pool, intervalMs, max }: PoolMonitorOptions): {
  stop: () => void;
} {
  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();

  const timer = setInterval(() => {
    const clients = getTenantDbClientStats();
    const saturated = pool.waitingCount > 0 || pool.totalCount - pool.idleCount >= max;

    const snapshot = {
      msg: 'db-pool-heartbeat',
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
        max,
      },
      sessions: {
        holdingConnection: clients.holdingConnection,
        maxIdleMs: clients.maxIdleMs,
      },
      eventLoopDelayP99Ms: Math.round(loopDelay.percentile(99) / NS_PER_MS),
    };

    // A saturated pool is one step from wedging every request — say so loudly.
    if (saturated) {
      console.error(JSON.stringify({ ...snapshot, level: 'error', saturated: true }));
    } else {
      console.log(JSON.stringify(snapshot));
    }

    loopDelay.reset();
  }, intervalMs);

  // The heartbeat must never be the reason the process stays alive.
  timer.unref();

  return {
    stop: () => {
      clearInterval(timer);
      loopDelay.disable();
    },
  };
}
