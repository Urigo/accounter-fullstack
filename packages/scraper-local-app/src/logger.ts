export class Logger {
  log: typeof console.log;
  error: typeof console.error;

  constructor() {
    this.log = console.log;
    this.error = console.error;
  }
}
