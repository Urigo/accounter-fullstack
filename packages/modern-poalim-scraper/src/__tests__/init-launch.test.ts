import { beforeEach, describe, expect, it, vi } from 'vitest';

const { launch } = vi.hoisted(() => ({
  launch: vi.fn(),
}));

vi.mock('puppeteer-extra', () => ({
  default: { use: vi.fn(), launch },
}));

vi.mock('puppeteer-extra-plugin-stealth', () => ({
  default: vi.fn(() => ({})),
}));

const { init } = await import('../index.js');

describe('init() browser launch', () => {
  beforeEach(() => {
    launch.mockReset();
    launch.mockResolvedValue({ close: vi.fn() });
  });

  it('launches the installed Google Chrome by default', async () => {
    await init();

    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith({ headless: true, args: [], channel: 'chrome' });
  });

  it('launches the given executable instead of the Chrome channel', async () => {
    await init({ headless: false, browser: { executablePath: '/opt/chrome/chrome' } });

    const options = launch.mock.calls[0]?.[0];
    expect(options).toEqual({ headless: false, args: [], executablePath: '/opt/chrome/chrome' });
    expect(options).not.toHaveProperty('channel');
  });

  it('keeps the user agent argument', async () => {
    await init({ userAgent: 'test-agent' });

    expect(launch).toHaveBeenCalledWith({
      headless: true,
      args: ['--user-agent=test-agent'],
      channel: 'chrome',
    });
  });
});
