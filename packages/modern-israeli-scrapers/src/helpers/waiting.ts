// From: https://github.com/eshaham/israeli-bank-scrapers/blob/master/src/helpers/waiting.ts

class TimeoutError extends Error {}

function timeoutPromise<T>(ms: number, promise: Promise<T>, description: string): Promise<T> {
  const timeout = new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      const error = new TimeoutError(description);
      reject(error);
    }, ms);
  });

  return Promise.race([
    promise,
    // casting to avoid type error- safe since this promise will always reject
    timeout as Promise<T>,
  ]);
}

/**
 * Wait until a promise resolves with a truthy value or reject after a timeout
 */
export function waitUntil<T>(
  asyncTest: () => Promise<T>,
  description = '',
  timeout = 10_000,
  interval = 100,
) {
  const promise = new Promise<T>((resolve, reject) => {
    function wait() {
      asyncTest()
        .then(value => {
          if (value) {
            resolve(value);
          } else {
            setTimeout(wait, interval);
          }
        })
        .catch(() => {
          reject();
        });
    }
    wait();
  });
  return timeoutPromise(timeout, promise, description);
}
