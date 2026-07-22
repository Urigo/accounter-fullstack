import { describe, expect, it } from 'vitest';
import { installProcessErrorHandlers, main, PACKAGE_NAME, start } from '../index.js';

describe('mcp-server entrypoint', () => {
  it('exposes the package name', () => {
    expect(PACKAGE_NAME).toBe('@accounter/mcp-server');
  });

  it('exports the startup surface', () => {
    // `main`/`start` bind a port and are covered via server tests; here we only
    // assert the entrypoint surface is wired up.
    expect(typeof main).toBe('function');
    expect(typeof start).toBe('function');
    expect(typeof installProcessErrorHandlers).toBe('function');
  });
});
