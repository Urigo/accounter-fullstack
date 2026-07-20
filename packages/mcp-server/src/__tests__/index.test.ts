import { describe, expect, it } from 'vitest';
import { main, PACKAGE_NAME } from '../index.js';

describe('mcp-server scaffold', () => {
  it('exposes the package name', () => {
    expect(PACKAGE_NAME).toBe('@accounter/mcp-server');
  });

  it('main() is a no-op and does not throw', () => {
    expect(() => main()).not.toThrow();
  });
});
