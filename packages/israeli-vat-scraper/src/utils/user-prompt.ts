import type { Logger } from './types.js';

type PromprTree = Record<string, [string, PromprTree]>;

export class UserPrompt {
  private _status: PromprTree = {};
  private errors: [string, unknown][] = [];
  constructor() {
    return;
  }

  public update = (locations: string[], status: string, logger: Logger): void => {
    let current = this._status;
    for (let i = 0; i < locations.length; i++) {
      const location = locations[i] as string;
      current[location] ??= ['', {}];
      if (i === locations.length - 1) {
        if (current[location]![0] === 'Error') {
          break;
        }
        current[location]![0] = status;
        break;
      }
      current = current[location]![1];
    }
    this.doLog(logger);
    return;
  };

  public doLog = (logger: Logger): void => {
    let message = '';
    const recursivePrint = (data: PromprTree, prefix: string): void => {
      const entries = Object.entries(data);
      if (entries.length > 0) {
        entries.sort((a, b) => (a[0] > b[0] ? 1 : -1));
        for (const [key, value] of entries) {
          message += `${prefix}${key}: ${value[0]}\n`;
          recursivePrint(value[1], prefix + '  ');
        }
      }
    };

    recursivePrint(this._status, '');
    logger.clear();
    logger.log(message);
  };

  public addError = (location: string[], error: unknown, logger: Logger): void => {
    this.update(location, 'Error', logger);
    this.errors.push([location.join('-'), error]);
  };

  public printErrors = (logger: Logger): void => {
    this.errors.sort((a, b) => (a[0] > b[0] ? 1 : b[0] > a[0] ? -1 : 0));

    logger.error(this.errors.map(e => `${e[0]}: ${JSON.stringify(e[1], null, '  ')}`));
  };
}
