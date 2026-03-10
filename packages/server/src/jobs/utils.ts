function msUntilNextUtcRun(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date(now);

  next.setUTCHours(hour, minute, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - now.getTime();
}

/**
 * Schedules a task to run daily at the specified UTC time.
 * Returns an object with a cancel method to stop the schedule.
 *
 * @param hour - The hour (0-23) at which to run the task daily in UTC
 * @param minute - The minute (0-59) at which to run the task daily in UTC
 * @param intervalInMs - The interval in milliseconds for subsequent runs after the first execution
 * @param task - The asynchronous task to execute
 * @returns An object with a `cancel` method to stop the scheduled task
 */
export function scheduleDailyAtUtc(
  hour: number,
  minute: number,
  intervalInMs: number,
  task: () => Promise<void>,
): { cancel: () => void } {
  let interval: NodeJS.Timeout | null = null;
  let inFlight = false;

  const runTaskSafely = async () => {
    if (inFlight) {
      return;
    }

    inFlight = true;
    try {
      await task();
    } catch (error) {
      console.error('Scheduled task failed', { error });
    } finally {
      inFlight = false;
    }
  };

  const delay = msUntilNextUtcRun(hour, minute);
  const firstRunTimer = setTimeout(() => {
    void runTaskSafely();

    interval = setInterval(() => {
      void runTaskSafely();
    }, intervalInMs);
    interval.unref();
  }, delay);

  firstRunTimer.unref();

  return {
    cancel: () => {
      clearTimeout(firstRunTimer);
      if (interval) {
        clearInterval(interval);
      }
    },
  };
}
