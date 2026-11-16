import { describe, expect, it } from 'vitest';
import { CHROME_MISSING_MESSAGE, isMissingBrowserError } from '../browser-errors.js';

describe('isMissingBrowserError', () => {
  it.each([
    [
      'puppeteer, Chrome channel not installed',
      "Could not find Google Chrome executable for channel 'chrome' at:\n - /opt/google/chrome/chrome.",
    ],
    [
      'puppeteer, downloaded build missing',
      'Could not find Chrome (ver. 140.0.7339.82). This can occur if either\n 1. you did not perform an installation before running the script',
    ],
    [
      'puppeteer, bad executablePath',
      'Browser was not found at the configured executablePath (/nope/chrome)',
    ],
    [
      'puppeteer, bad configured path',
      'Tried to find the browser at the configured path (/nope/chrome), but no executable was found.',
    ],
    [
      'Playwright, Chrome channel not installed',
      "browserType.launch: Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome\nRun \"npx playwright install chrome\"",
    ],
    [
      'Playwright, bad executablePath',
      "browserType.launch: Failed to launch chromium because executable doesn't exist at /nope/chrome",
    ],
    [
      'Playwright, downloaded build missing',
      "browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome",
    ],
  ])('matches %s', (_label, message) => {
    expect(isMissingBrowserError(new Error(message))).toBe(true);
  });

  it('matches a missing-browser error wrapped in a cause chain', () => {
    const launchError = new Error(
      "Could not find Google Chrome executable for channel 'chrome' at:\n - /opt/google/chrome/chrome.",
    );
    const wrapped = new Error('newHomePage - launch failed', {
      cause: new Error('inner', { cause: launchError }),
    });
    expect(isMissingBrowserError(wrapped)).toBe(true);
  });

  it('matches a thrown string', () => {
    expect(isMissingBrowserError("Chromium distribution 'chrome' is not found")).toBe(true);
  });

  it.each([
    ['an unrelated error', new Error('Hapoalim login failed: Unknown Error')],
    ['a navigation timeout', new Error('Navigation timeout of 30000 ms exceeded')],
    ['null', null],
    ['undefined', undefined],
  ])('does not match %s', (_label, error) => {
    expect(isMissingBrowserError(error)).toBe(false);
  });

  it('stops on a cyclic cause chain', () => {
    const a = new Error('a');
    const b = new Error('b', { cause: a });
    (a as { cause?: unknown }).cause = b;
    expect(isMissingBrowserError(a)).toBe(false);
  });
});

describe('CHROME_MISSING_MESSAGE', () => {
  it('tells the user what to install and where', () => {
    expect(CHROME_MISSING_MESSAGE).toContain('Google Chrome is not installed');
    expect(CHROME_MISSING_MESSAGE).toContain('https://www.google.com/chrome/');
  });
});
