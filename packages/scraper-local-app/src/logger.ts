export class Logger {
  log: typeof console.log;
  error: typeof console.error;

  public reLog: () => Promise<void>;

  constructor() {
    this.reLog = async () => {
      Promise.resolve();
    };
    this.log = (...input) => {
      const prevLog = this.reLog;
      this.reLog = async () => prevLog().then(() => console.log(...input));
      console.log(...input);
    };
    this.error = (...input) => {
      const prevLog = this.reLog;
      this.reLog = async () => prevLog().then(() => console.error(...input));
      console.error(...input);
    };
  }
}
