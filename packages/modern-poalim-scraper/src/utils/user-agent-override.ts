import type { Page } from 'puppeteer';

// This file is used to override the user agent of the page
// to make it look like a real browser.
// Based on the code from: "puppeteer-extra-plugin-stealth"
// https://github.com/berstend/puppeteer-extra/blob/master/packages/puppeteer-extra-plugin-stealth/evasions/user-agent-override/index.js
export async function userAgentOverride(page: Page) {
  let ua = (await page.browser().userAgent()).replace('HeadlessChrome/', 'Chrome/');

  if (ua.includes('Linux') && !ua.includes('Android')) {
    ua = ua.replace(/\(([^)]+)\)/, '(Windows NT 10.0; Win64; x64)');
  }

  const uaVersion =
    (ua.includes('Chrome/')
      ? ua.match(/Chrome\/([\d|.]+)/)?.[1]
      : (await page.browser().version()).match(/\/([\d|.]+)/)?.[1]) ?? '0.0';

  const getPlatform = (extended = false) => {
    if (ua.includes('Mac OS X')) {
      return extended ? 'Mac OS X' : 'MacIntel';
    }
    if (ua.includes('Android')) {
      return 'Android';
    }
    if (ua.includes('Linux')) {
      return 'Linux';
    }
    return extended ? 'Windows' : 'Win32';
  };

  const getBrands = () => {
    const seed = uaVersion.split('.')[0] as unknown as number;

    const order = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ][seed % 6] as [number, number, number];
    const escapedChars = [' ', ' ', ';'];

    const greasyBrand = `${escapedChars[order[0]]}Not${
      escapedChars[order[1]]
    }A${escapedChars[order[2]]}Brand`;

    const greasedBrandVersionList = [];
    greasedBrandVersionList[order[0]] = {
      brand: greasyBrand,
      version: '99',
    };
    greasedBrandVersionList[order[1]] = {
      brand: 'Chromium',
      version: seed,
    };
    greasedBrandVersionList[order[2]] = {
      brand: 'Google Chrome',
      version: seed,
    };

    return greasedBrandVersionList;
  };

  const getPlatformVersion = () => {
    if (ua.includes('Mac OS X ')) {
      return ua.match(/Mac OS X ([^)]+)/)?.[1];
    }
    if (ua.includes('Android ')) {
      return ua.match(/Android ([^;]+)/)?.[1];
    }
    if (ua.includes('Windows ')) {
      return ua.match(/Windows .*?([\d|.]+);?/)?.[1];
    }
    return '';
  };

  const getPlatformArch = () => (getMobile() ? '' : 'x86');

  const getPlatformModel = () => (getMobile() ? ua.match(/Android.*?;\s([^)]+)/)?.[1] : '');

  const getMobile = () => ua.includes('Android');

  const override = {
    userAgent: ua,
    platform: getPlatform(false),
    userAgentMetadata: {
      brands: getBrands(),
      fullVersion: uaVersion,
      platform: getPlatform(true),
      platformVersion: getPlatformVersion(),
      architecture: getPlatformArch(),
      model: getPlatformModel(),
      mobile: getMobile(),
      acceptLanguage: 'en-US,en',
    },
  };

  if ('_client' in page) {
    const client = typeof page._client === 'function' ? page._client() : page._client;
    client.send('Network.setUserAgentOverride', override);
  }
}
