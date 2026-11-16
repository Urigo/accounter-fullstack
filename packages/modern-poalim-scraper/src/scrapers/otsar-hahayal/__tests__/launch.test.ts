import { beforeEach, describe, expect, it, vi } from 'vitest';

const { launch, browserClose } = vi.hoisted(() => ({
  launch: vi.fn(),
  browserClose: vi.fn(),
}));

vi.mock('playwright', () => ({
  chromium: { launch },
}));

vi.mock('../login-fetch-user-data.js', () => ({
  loginAndGetUserData: vi.fn().mockResolvedValue({}),
}));

const { otsarHahayal } = await import('../index.js');

const credentials = { userCode: 'user', password: 'pass' };

describe('otsarHahayal() browser launch', () => {
  beforeEach(() => {
    launch.mockReset();
    browserClose.mockReset();
    launch.mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({ newPage: vi.fn().mockResolvedValue({}) }),
      close: browserClose,
    });
  });

  it('launches the installed Google Chrome by default', async () => {
    const scraper = await otsarHahayal(credentials);
    await scraper.close();

    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith({ headless: false, channel: 'chrome' });
  });

  it('launches the given executable instead of the Chrome channel', async () => {
    const scraper = await otsarHahayal(credentials, {
      headless: true,
      browser: { executablePath: '/opt/chrome/chrome' },
    });
    await scraper.close();

    const options = launch.mock.calls[0]?.[0];
    expect(options).toEqual({ headless: true, executablePath: '/opt/chrome/chrome' });
    expect(options).not.toHaveProperty('channel');
  });
});
