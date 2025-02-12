export class Logger {
  log: typeof console.log;
  error: typeof console.error;
  private logQueue: Array<() => void>;

  constructor() {
    this.logQueue = [];
    this.log = (...input) => {
      this.logQueue.push(() => console.log(...input));
      console.log(...input);
    };
    this.error = (...input) => {
      this.logQueue.push(() => console.error(...input));
      console.error(...input);
    };
  }

  public reLog = async (): Promise<void> => {
    for (const logFn of this.logQueue) {
      logFn();
    }
    return Promise.resolve();
  };
}
