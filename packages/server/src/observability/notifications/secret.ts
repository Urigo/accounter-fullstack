import { inspect } from 'node:util';

const REDACTED = '[REDACTED]';

/**
 * Holds a credential (a Slack webhook URL) so that accidental serialization — a log field, a
 * `JSON.stringify` of a config object, `util.inspect` in a debugger — prints `[REDACTED]`. Only
 * `reveal()` returns the value.
 */
export class Secret {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  reveal(): string {
    return this.#value;
  }

  equals(other: Secret): boolean {
    return this.#value === other.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [inspect.custom](): string {
    return REDACTED;
  }
}
