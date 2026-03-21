import { describe, expect, it } from 'vitest';
import { extractScraperError } from '../helpers/scraper-error.js';

describe('extractScraperError', () => {
  it('returns "Sync failed" for non-Error values', () => {
    expect(extractScraperError('string error')).toBe('Sync failed');
    expect(extractScraperError(42)).toBe('Sync failed');
    expect(extractScraperError(null)).toBe('Sync failed');
    expect(extractScraperError(undefined)).toBe('Sync failed');
  });

  it('returns e.message when there is no stderr/stdout', () => {
    const e = new Error('Some generic failure');
    expect(extractScraperError(e)).toBe('Some generic failure');
  });

  it('extracts the last Error: line from stderr', () => {
    const e = Object.assign(new Error('Command failed: /path/tsx /path/index.ts'), {
      stderr: [
        'Mizrahi [mizrahi]: Logging in...',
        'Error: Mizrahi [mizrahi]: Scraping failed - TIMEOUT: waiting for url',
        '    at scrapeMizrahi (src/scrapers/mizrahi/index.ts:75:11)',
      ].join('\n'),
      stdout: '',
    });
    expect(extractScraperError(e)).toBe(
      'Error: Mizrahi [mizrahi]: Scraping failed - TIMEOUT: waiting for url',
    );
  });

  it('returns the last Error: line when multiple exist', () => {
    const e = Object.assign(new Error('Command failed'), {
      stderr: [
        'Error: First error encountered',
        'some intermediate output',
        'Error: Second error - the real one',
      ].join('\n'),
      stdout: '',
    });
    expect(extractScraperError(e)).toBe('Error: Second error - the real one');
  });

  it('falls back to stdout when stderr is empty', () => {
    const e = Object.assign(new Error('Command failed'), {
      stderr: '',
      stdout: 'Error: Error from stdout',
    });
    expect(extractScraperError(e)).toBe('Error: Error from stdout');
  });

  it('falls back to last 500 chars of combined output when no Error: line', () => {
    const e = Object.assign(new Error('Command failed'), {
      stderr: 'Some non-error output line\nAnother line',
      stdout: '',
    });
    const result = extractScraperError(e);
    expect(result).toContain('Some non-error output line');
  });

  it('prefers stderr over stdout', () => {
    const e = Object.assign(new Error('Command failed'), {
      stderr: 'Error: From stderr',
      stdout: 'Error: From stdout',
    });
    expect(extractScraperError(e)).toBe('Error: From stderr');
  });

  it('handles whitespace-only stderr by using stdout', () => {
    const e = Object.assign(new Error('Command failed'), {
      stderr: '   \n  ',
      stdout: 'Error: From stdout fallback',
    });
    expect(extractScraperError(e)).toBe('Error: From stdout fallback');
  });

  it('truncates combined output to 500 chars when no Error: line found', () => {
    const longLine = 'x'.repeat(600);
    const e = Object.assign(new Error('Command failed'), {
      stderr: longLine,
      stdout: '',
    });
    const result = extractScraperError(e);
    expect(result.length).toBeLessThanOrEqual(500);
  });
});
