import { readdirSync } from 'node:fs';
import { GraphQLError } from 'graphql';
import type { YogaLogger } from 'graphql-yoga';

/**
 * Single-line JSON logging.
 *
 * Every record is one JSON object on one line on stdout, `{"msg": …, "level": …, "time": …,
 * …fields}` — the same shape as `db-pool-heartbeat` and `graphql-operation`. One line per record
 * keeps a record whole in the log pipeline: a multi-line `util.inspect` dump or stack trace becomes
 * one record per line there, and those lines interleave across concurrent requests.
 *
 * `log(level, msg, fields)` is the stable call-site API. A file gets its own copy, tagged with where
 * the line came from, from `getLogger(import.meta.url)`: `const { log } = getLogger(import.meta.url)`
 * adds `module` (the `src/modules/<dir>`, or the top-level `src` directory) and `component` (the file
 * name) to every record. `setLogBaseFields` adds process-wide fields (`service`, `env`, `release`),
 * set once at startup.
 *
 * Behind it are two seams, so ambient request context (`AsyncLocalStorage`), tests and another sink
 * can plug in without touching call sites: `setLogContextProvider` (fields merged into every record)
 * and `setLogWriter` (where a line goes).
 *
 * Safety, applied to every record (`toJsonLine`):
 * - a field whose key names a credential (`authorization`, `cookie`, `*token`, `*secret`,
 *   `*password`, `*apiKey`, …) is replaced with `[REDACTED]`, at any depth;
 * - every string is scrubbed of JWTs, `Bearer`/`Basic` credentials, Slack webhook URLs and email
 *   addresses, and capped at 2000 characters;
 * - errors go through `serializeError`, which keeps an allowlist of fields and caps the message at
 *   500 characters.
 *
 * Guidance:
 * - `msg` is a stable, greppable identifier (`kebab-case`), not a sentence with values spliced into
 *   it. Values go in fields.
 * - Internal IDs only: never emails, names, tokens, request bodies or upstream response bodies. The
 *   redaction above is a backstop, not a licence.
 * - **Log once, at the boundary.** A helper that logs an error and rethrows it multiplies one failure
 *   into a line per call site, and a fan-out into dozens. Throw (with `cause`) and let the boundary
 *   log it: every error that reaches the GraphQL response is already logged by `requestLogPlugin`,
 *   with the operation and request that produced it. Log where the error *stops* — a catch that
 *   swallows it, returns a `CommonError`, or retries — or where only that site knows the detail
 *   (e.g. the upstream status of a third-party call).
 * - Data-quality findings about the user's own records are `info`, not `error`: `error` is for
 *   server faults someone should act on.
 */

/** `fatal`: the process is going down. Always written, whatever the configured level. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * A minimum level to write. `fatal` is always written, so it is never a threshold; `silent` drops
 * everything else (e.g. in tests).
 */
export type LogThreshold = Exclude<LogLevel, 'fatal'> | 'silent';

export type LogFields = Record<string, unknown>;

/** Writes one finished line (newline included). */
export type LogWriter = (line: string, level: LogLevel) => void;

const LEVEL_SCORE: Record<LogLevel | 'silent', number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
  silent: 5,
};

/** Frames kept from a stack trace: enough to locate the throw, not a screenful per error. */
const MAX_STACK_FRAMES = 8;
/** How deep a `cause` chain is followed. */
const MAX_CAUSE_DEPTH = 4;
/** Longest string written in any field; a longer one is cut. */
const MAX_STRING_LENGTH = 2000;
/** Longest error message kept by `serializeError`. */
const MAX_ERROR_MESSAGE_LENGTH = 500;
/** Fields every record starts with; a field passed by a caller or the context can't replace them. */
const RESERVED_KEYS = new Set(['msg', 'level', 'time']);

let threshold: LogThreshold = 'info';
let moduleThresholds = new Map<string, LogThreshold>();
let baseFields: LogFields = {};
let contextProvider: (() => LogFields | undefined) | undefined;
let writer: LogWriter = writeToStdout;

/** Sets the minimum level written, process-wide. Set once at startup from `SERVER_LOG_LEVEL`. */
export function setLogLevel(level: LogThreshold): void {
  threshold = level;
}

/**
 * Per-module minimum levels, overriding the process-wide one for records of that `module` (from
 * `SERVER_LOG_LEVEL_OVERRIDES`, e.g. `deel=debug,db=warn`). Pass nothing to remove them.
 */
export function setModuleLogLevels(levels?: Record<string, LogThreshold>): void {
  moduleThresholds = new Map(Object.entries(levels ?? {}));
}

/** Whether a record at `level` is written, for `module` when it has its own level. */
export function isLogLevelEnabled(level: LogLevel, module?: string): boolean {
  if (level === 'fatal') {
    return true;
  }
  const min = (module === undefined ? undefined : moduleThresholds.get(module)) ?? threshold;
  return LEVEL_SCORE[level] >= LEVEL_SCORE[min];
}

/** Modules a scope can log as without a matching `src/modules` directory (see `originOf`). */
const NON_DIRECTORY_MODULES = ['startup', 'db', 'shutdown'];

/**
 * Every `module` a record can carry: the `src/modules` directories, the top-level `src` directories
 * and the infra scopes. Used to warn about a per-module level that matches nothing.
 */
export function knownLogModules(): Set<string> {
  const known = new Set(NON_DIRECTORY_MODULES);
  const directoriesOf = (url: URL) =>
    readdirSync(url, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  try {
    // This file is `src/observability/log.ts` (or `dist/observability/log.js`, which mirrors it).
    for (const name of directoriesOf(new URL('../', import.meta.url))) {
      if (name !== 'modules' && name !== '__tests__' && name !== '__generated__') {
        known.add(name);
      }
    }
    for (const name of directoriesOf(new URL('../modules/', import.meta.url))) {
      known.add(name);
    }
  } catch {
    // Unreadable layout: the caller just can't tell unknown modules apart.
  }
  return known;
}

/**
 * Process-wide fields on every record (`service`, `env`, `release`), below the context's and the call
 * site's own. Set once at startup; pass nothing to remove them.
 */
export function setLogBaseFields(fields?: LogFields): void {
  baseFields = { ...fields };
}

/**
 * Fields merged into every record, below the call site's own (e.g. the current request's ids from
 * an `AsyncLocalStorage`). Pass nothing to remove it.
 */
export function setLogContextProvider(provider?: () => LogFields | undefined): void {
  contextProvider = provider;
}

/** Where finished lines go; stdout by default. Pass nothing to restore it. */
export function setLogWriter(next?: LogWriter): void {
  writer = next ?? writeToStdout;
}

/** Writes one record as a single JSON line. */
export function log(level: LogLevel, msg: string, fields?: LogFields): void {
  const module = fields?.['module'];
  if (!isLogLevelEnabled(level, typeof module === 'string' ? module : undefined)) {
    return;
  }
  const record: LogFields = { msg, level, time: new Date().toISOString() };
  let context: LogFields | undefined;
  try {
    context = contextProvider?.();
  } catch {
    // A broken context provider must not cost the record.
  }
  for (const source of [baseFields, context, fields]) {
    for (const [key, value] of Object.entries(source ?? {})) {
      // `msg`, `level` and `time` are what a log query filters on: a field must not shadow them.
      if (!RESERVED_KEYS.has(key)) {
        record[key] = value;
      }
    }
  }
  writer(`${toJsonLine(record)}\n`, level);
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => log('debug', msg, fields),
  info: (msg: string, fields?: LogFields) => log('info', msg, fields),
  warn: (msg: string, fields?: LogFields) => log('warn', msg, fields),
  error: (msg: string, fields?: LogFields) => log('error', msg, fields),
  fatal: (msg: string, fields?: LogFields) => log('fatal', msg, fields),
};

export type ScopedLogger = typeof logger & { log: typeof log };

/** Where a log line came from: the log `module` and the `component` (file) within it. */
export type LogOrigin = { module: string; component: string };

/**
 * The origin of a source file, from its URL or path. Works on `src` and on `dist`, which mirrors it:
 * - `modules/<dir>/…` → `<dir>` (so a module's directory name is its log module);
 * - any other nested file → its top-level directory (`plugins`, `observability`, `jobs`, …);
 * - the top-level `index` → `startup`, any other top-level file → its own name.
 *
 * `component` is the file name without its extension (`tenant-db-client`, `charges.resolver`).
 */
export function originOf(url: string): LogOrigin {
  const path = url.replaceAll('\\', '/');
  // Greedy, so the last `/src/` or `/dist/` wins: the checkout itself may sit under a `src`.
  const relative = /^.*\/(?:src|dist)\/(.+)$/.exec(path)?.[1] ?? path.split('/').at(-1) ?? path;
  const segments = relative.split('/');
  const component = (segments.at(-1) ?? relative).replace(/\.[^.]+$/, '');
  if (segments.length === 1) {
    return { module: component === 'index' ? 'startup' : component, component };
  }
  if (segments[0] === 'modules' && segments.length > 2) {
    return { module: segments[1], component };
  }
  return { module: segments[0], component };
}

/**
 * A logger whose records carry their origin (`module`, `component`; see `originOf`). Same
 * signatures as `log` / `logger.*`, and a call site's own field overrides a bound one. The functions
 * don't use `this`, so they can be destructured:
 *
 * ```ts
 * const { log } = getLogger(import.meta.url);
 * ```
 *
 * `override` replaces part of the derived origin, for infra scopes that cut across files: the DB
 * client and pool are `db`, process shutdown is `shutdown`
 * (`getLogger(import.meta.url, { module: 'db' })`).
 */
export function getLogger(url: string, override?: Partial<LogOrigin>): ScopedLogger {
  const origin = { ...originOf(url), ...override };
  const scoped = (level: LogLevel, msg: string, fields?: LogFields) =>
    log(level, msg, { ...origin, ...fields });
  return {
    log: scoped,
    debug: (msg, fields) => scoped('debug', msg, fields),
    info: (msg, fields) => scoped('info', msg, fields),
    warn: (msg, fields) => scoped('warn', msg, fields),
    error: (msg, fields) => scoped('error', msg, fields),
    fatal: (msg, fields) => scoped('fatal', msg, fields),
  };
}

let stdoutGuarded = false;

/**
 * The default writer: one stream, stdout, for every level (so a `| pino-pretty` dev pipe sees it all).
 *
 * Like `console.*`, a failed write is swallowed: with no listener, an `EPIPE` (the reader of the pipe
 * went away) is an unhandled `'error'` event and takes the process down, and there is nowhere left to
 * report it anyway.
 */
function writeToStdout(line: string): void {
  if (!stdoutGuarded) {
    stdoutGuarded = true;
    process.stdout.on('error', () => {});
  }
  try {
    process.stdout.write(line);
  } catch {
    // See above.
  }
}

/**
 * The parts of an error worth a log line: name, message, code, a trimmed stack and the `cause` chain.
 * GraphQL `extensions` are reduced to their `code` — they can carry upstream request and response
 * details (headers, bodies) that must not reach the logs.
 */
export function serializeError(error: unknown, depth = 0): LogFields {
  if (!(error instanceof Error)) {
    return serializeNonError(error);
  }

  const out: LogFields = {
    name: error.name,
    message: cap(error.message, MAX_ERROR_MESSAGE_LENGTH),
  };
  const graphQLError = isGraphQLError(error);
  const code = graphQLError
    ? error.extensions?.['code']
    : (error as Error & { code?: unknown }).code;
  if (typeof code === 'string' || typeof code === 'number') {
    out['code'] = code;
  }
  if (graphQLError && error.path) {
    out['path'] = error.path.join('.');
  }
  const stack = trimStack(error.stack);
  if (stack) {
    out['stack'] = stack;
  }
  if (depth < MAX_CAUSE_DEPTH) {
    // A GraphQLError's `originalError` is the error a resolver threw; treat it as the cause.
    const cause = graphQLError ? (error.originalError ?? error.cause) : error.cause;
    if (cause !== undefined && cause !== null) {
      out['cause'] = serializeError(cause, depth + 1);
    }
    if (error instanceof AggregateError) {
      out['errors'] = error.errors.slice(0, 5).map(inner => serializeError(inner, depth + 1));
    }
  }
  return out;
}

/** Whether `value` is a `GraphQLError`, by the same `instanceof` check Yoga masks errors with. */
export function isGraphQLError(value: unknown): value is GraphQLError {
  return value instanceof GraphQLError;
}

// Errors already written by a boundary log (see `markLogged`). Weak, so it holds nothing alive.
const loggedErrors = new WeakSet<object>();

/**
 * Records that `error` has been logged in full, so another boundary that sees the same object (Yoga
 * logs every error it masks) can skip it.
 */
export function markLogged(error: unknown): void {
  if (typeof error === 'object' && error !== null) {
    loggedErrors.add(error);
  }
}

export function wasLogged(error: unknown): boolean {
  return typeof error === 'object' && error !== null && loggedErrors.has(error);
}

/**
 * Yoga's logger, writing single-line JSON records at the process-wide level. Hive forwards its own
 * logs to this logger too.
 *
 * Yoga logs every error it masks. An execution error has already been logged by `requestLogPlugin`
 * together with its operation, so it is skipped here; anything else (an error outside execution,
 * e.g. while building the context) is still logged.
 */
export function createYogaLogger(): YogaLogger {
  const at =
    (level: LogLevel) =>
    (...args: unknown[]): void => {
      if (!isLogLevelEnabled(level)) {
        return;
      }
      if (args.length === 1 && wasLogged(args[0])) {
        return;
      }
      const text: string[] = [];
      const details: unknown[] = [];
      let error: unknown;
      for (const arg of args) {
        if (typeof arg === 'string') {
          text.push(arg);
        } else if (arg instanceof Error && error === undefined) {
          error = arg;
        } else if (arg !== undefined && arg !== null) {
          // Hive forwards `logger[level](msg, attrs)` with `attrs` undefined when it has none.
          details.push(arg);
        }
      }
      const fields: LogFields = { source: 'yoga' };
      if (error !== undefined) {
        fields['error'] = serializeError(error);
      }
      if (details.length) {
        fields['details'] = details;
      }
      // A fixed `msg` when Yoga logs a bare error (it does for every error it masks): `msg` stays a
      // stable identifier, and the text is in `error.message`, capped like any error message.
      const msg = text.join(' ') || (error === undefined ? 'yoga' : 'yoga-error');
      log(level, msg, fields);
    };
  return { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}

function trimStack(stack: string | undefined): string | undefined {
  if (!stack) {
    return undefined;
  }
  // The first line repeats `name: message`, which is already in the record.
  const frames = stack
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('at '));
  return frames.length ? frames.slice(0, MAX_STACK_FRAMES).join(' | ') : undefined;
}

/** Fields kept from a thrown plain object, which may otherwise carry headers, payloads or bodies. */
const NON_ERROR_FIELDS = ['name', 'message', 'code', 'status', 'http_code'] as const;

/**
 * A thrown value that isn't an `Error`. Some SDKs reject with a plain object (Cloudinary does), and
 * one can carry the request or response: only an allowlist of scalar fields is kept, and the message
 * of a nested `error` object when there is no top-level one.
 */
function serializeNonError(value: unknown): LogFields {
  if (typeof value !== 'object' || value === null) {
    return { message: cap(String(value), MAX_ERROR_MESSAGE_LENGTH) };
  }
  const object = value as Record<string, unknown>;
  const out: LogFields = {};
  for (const field of NON_ERROR_FIELDS) {
    const fieldValue = object[field];
    if (typeof fieldValue === 'string') {
      out[field] = cap(fieldValue, MAX_ERROR_MESSAGE_LENGTH);
    } else if (typeof fieldValue === 'number') {
      out[field] = fieldValue;
    }
  }
  const nested = object['error'];
  if (out['message'] === undefined && typeof nested === 'object' && nested !== null) {
    const nestedMessage = (nested as Record<string, unknown>)['message'];
    if (typeof nestedMessage === 'string') {
      out['message'] = cap(nestedMessage, MAX_ERROR_MESSAGE_LENGTH);
    }
  }
  out['message'] ??= `non-error ${Array.isArray(value) ? 'array' : 'object'} thrown`;
  return out;
}

/**
 * Keys whose value is a credential, compared lowercased with `-` and `_` removed. A key ending in
 * `token`, `secret`, `password` or `apikey` is redacted too.
 */
const REDACTED_KEYS = new Set([
  'authorization',
  'proxyauthorization',
  'cookie',
  'setcookie',
  'xgatewaycptoken',
  'xdevauth',
  'xbusinessscope',
  'credentialsencryptionkey',
  'connectionstring',
]);
const REDACTED_KEY_SUFFIXES = ['token', 'secret', 'password', 'apikey'];

function isRedactedKey(key: string): boolean {
  const normalized = key.toLowerCase().replaceAll(/[-_]/g, '');
  return (
    REDACTED_KEYS.has(normalized) ||
    REDACTED_KEY_SUFFIXES.some(suffix => normalized.endsWith(suffix))
  );
}

const SCRUB_PATTERNS: Array<[RegExp, string]> = [
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[jwt]'],
  // At least 8 characters, so prose like "Basic plan" survives.
  [/\b(Bearer|Basic)\s+[\w.~+/=-]{8,}/gi, '$1 [redacted]'],
  [/https:\/\/hooks\.slack\.com\/services\/\S+/g, '[slack-webhook]'],
  [/[\w.%+-]+@[a-z\d.-]+\.[a-z]{2,}/gi, '[email]'],
];

/** Removes credentials and email addresses from free text (messages, upstream reasons). */
export function scrubText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of SCRUB_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Scrubs, then cuts at `max` characters. Scrubbing first matters: a cut through a JWT or a `Bearer`
 * credential leaves a fragment the patterns no longer recognise.
 */
function cap(text: string, max: number): string {
  const scrubbed = scrubText(text);
  return scrubbed.length > max
    ? `${scrubbed.slice(0, max)}…[${scrubbed.length - max} more]`
    : scrubbed;
}

/**
 * `JSON.stringify` that never throws: credentials redacted, strings scrubbed and capped, errors
 * serialized, bigints as strings, cycles cut.
 */
function toJsonLine(record: LogFields): string {
  const ancestors: object[] = [];
  try {
    return JSON.stringify(record, function replacer(this: unknown, key, value: unknown) {
      if (key && value !== undefined && value !== null && isRedactedKey(key)) {
        return '[REDACTED]';
      }
      // `JSON.stringify` calls `toJSON` before the replacer, and `GraphQLError#toJSON` keeps every
      // extension: check the raw value, so every error goes through `serializeError`.
      const raw = (this as Record<string, unknown>)[key];
      // A serialized error goes through the cycle bookkeeping below like any other object: its
      // `cause` is visited with it as `this`, and unwinding to an object that isn't on the stack
      // would empty it.
      const out = raw instanceof Error ? serializeError(raw) : value;
      if (typeof out === 'string') {
        return cap(out, MAX_STRING_LENGTH);
      }
      if (typeof out === 'bigint') {
        return out.toString();
      }
      if (typeof out !== 'object' || out === null) {
        return out;
      }
      // `this` is the object holding `out`: unwind to it, then check for a cycle.
      while (ancestors.length > 0 && ancestors.at(-1) !== this) {
        ancestors.pop();
      }
      if (ancestors.includes(out)) {
        return '[Circular]';
      }
      ancestors.push(out);
      return out;
    });
  } catch (error) {
    // A getter or `toJSON` threw. This record skips the replacer, so its strings get the same
    // scrubbing and caps by hand.
    return JSON.stringify({
      msg: cap(String(record['msg']), MAX_STRING_LENGTH),
      level: record['level'],
      time: record['time'],
      logError:
        error instanceof Error
          ? cap(error.message, MAX_ERROR_MESSAGE_LENGTH)
          : 'unserializable record',
    });
  }
}
