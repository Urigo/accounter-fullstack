const DEBUG_ENABLED = process.env.DEBUG?.split(',').includes('accounter:test');

export const debugLog = (...args: unknown[]) => {
  if (DEBUG_ENABLED) console.debug('[test-db]', ...args);
};

export type PoolLike = { totalCount: number; idleCount: number; waitingCount: number };

export function isPoolHealthy(pool: PoolLike) {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

export function emitMetrics(label: string, pool?: PoolLike) {
  if (!DEBUG_ENABLED) return;
  const metrics = pool ? isPoolHealthy(pool) : undefined;
  if (metrics) {
    console.debug('[test-db][metrics]', label, metrics);
  } else {
    console.debug('[test-db][metrics]', label);
  }
}

export { DEBUG_ENABLED };
