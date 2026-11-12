import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { Pool } from 'pg';
import { startPoolMonitor } from '../pool-monitor.js';

function fakePool(state: { totalCount: number; idleCount: number; waitingCount: number }) {
  return state as unknown as Pool;
}

let stdout: MockInstance;
let stderr: MockInstance;

beforeEach(() => {
  vi.useFakeTimers();
  stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const heartbeats = () =>
  [...stdout.mock.calls, ...stderr.mock.calls]
    .map(([chunk]) => JSON.parse(String(chunk)) as Record<string, unknown>)
    .filter(record => record['msg'] === 'db-pool-heartbeat');

describe('startPoolMonitor', () => {
  it('reports an idle pool only every idleReportIntervalMs', () => {
    const monitor = startPoolMonitor({
      pool: fakePool({ totalCount: 2, idleCount: 2, waitingCount: 0 }),
      intervalMs: 1000,
      max: 10,
      idleReportIntervalMs: 5000,
    });

    vi.advanceTimersByTime(10_000);
    monitor.stop();

    // Ticks at 1s and 6s report; the eight in between are skipped.
    expect(heartbeats()).toHaveLength(2);
  });

  it('reports every tick while connections are checked out', () => {
    const monitor = startPoolMonitor({
      pool: fakePool({ totalCount: 3, idleCount: 1, waitingCount: 0 }),
      intervalMs: 1000,
      max: 10,
      idleReportIntervalMs: 5000,
    });

    vi.advanceTimersByTime(3000);
    monitor.stop();

    expect(heartbeats()).toHaveLength(3);
  });

  it('reports a saturated pool at error level', () => {
    const monitor = startPoolMonitor({
      pool: fakePool({ totalCount: 10, idleCount: 0, waitingCount: 4 }),
      intervalMs: 1000,
      max: 10,
    });

    vi.advanceTimersByTime(1000);
    monitor.stop();

    expect(heartbeats()).toEqual([
      expect.objectContaining({
        level: 'error',
        saturated: true,
        pool: { total: 10, idle: 0, waiting: 4, max: 10 },
      }),
    ]);
  });
});
