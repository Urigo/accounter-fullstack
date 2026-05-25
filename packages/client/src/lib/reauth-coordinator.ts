export type ReauthOutcome = 'authenticated' | 'redirect';

type ReauthHandler = () => Promise<ReauthOutcome>;

let handler: ReauthHandler | null = null;
let inFlight: Promise<ReauthOutcome> | null = null;

export function setReauthHandler(fn: ReauthHandler | null): void {
  handler = fn;
}

/**
 * Asks the React layer to interactively re-authenticate the user (modal + Auth0 popup).
 * Single-flight: concurrent failed operations share one prompt. Falls back to 'redirect'
 * when no handler is registered (e.g. route loaders running before React mounts).
 */
export function requestInteractiveReauth(): Promise<ReauthOutcome> {
  if (!handler) {
    return Promise.resolve('redirect');
  }

  inFlight ||= handler().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
