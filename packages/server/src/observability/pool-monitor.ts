import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { Pool } from 'pg';
import { getTenantDbClientStats } from '../modules/app-providers/tenant-db-client.js';
import { log } from './log.js';

const NS_PER_MS = 1e6;
/** How often an idle pool still reports, as proof the event loop is turning. */
const DEFAULT_IDLE_REPORT_INTERVAL_MS = 5 * 60_000;

export interface PoolMonitorOptions {
  pool: Pool;
  /** Emit a heartbeat this often. */
  intervalMs: number;
  /** Pool size, for saturation reporting. */
  max: number;
  /**
   * While the pool is idle (nothing checked out, waiting or held), report only this often instead of
   * every `intervalMs`. Defaults to 5 minutes.
   */
  idleReportIntervalMs?: number;
}

/**
 * Periodic health heartbeat for the Postgres pool.
 *
 * The failure this exists for is silent by construction: an exhausted pool
 * produces no error, no CPU, and no log line — requests simply queue in
 * `pool.connect()` forever. `waiting > 0` alongside `idle === 0` is that state,
 * visible in a single line, and the heartbeat continuing to print at all is
 * proof the event loop is still turning.
 *
 * An idle pool — nothing checked out, waiting or held — reports only every
 * `idleReportIntervalMs`: at every tick it was most of the production log, and
 * an idle snapshot says nothing the next one won't.
 */
export function startPoolMonitor({
  pool,
  intervalMs,
  max,
  idleReportIntervalMs = DEFAULT_IDLE_REPORT_INTERVAL_MS,
}: PoolMonitorOptions): {
  stop: () => void;
} {
  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();
  let lastReportAt = Number.NEGATIVE_INFINITY;

  const timer = setInterval(() => {
    const clients = getTenantDbClientStats();
    const checkedOut = pool.totalCount - pool.idleCount;
    const saturated = pool.waitingCount > 0 || checkedOut >= max;
    const idle = checkedOut === 0 && pool.waitingCount === 0 && clients.holdingConnection === 0;
    const now = Date.now();
    if (idle && now - lastReportAt < idleReportIntervalMs) {
      // Not reset: the next reported p99 covers every tick since the last report.
      return;
    }
    lastReportAt = now;

    const snapshot = {
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
      log('error', 'db-pool-heartbeat', { ...snapshot, saturated: true });
    } else {
      log('info', 'db-pool-heartbeat', snapshot);
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
