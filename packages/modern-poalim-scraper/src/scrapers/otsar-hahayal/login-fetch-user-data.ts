import { Page } from 'playwright';
import { sleep } from '../../utils/sleep.js';
import { OtsarHahayalCredentials } from './index.js';

export async function loginAndGetUserData(
  credentials: OtsarHahayalCredentials,
  page: Page,
): Promise<Record<string, string>> {
  const BASE_URL = 'https://www.bankotsar.co.il/business/';
  await page.goto(BASE_URL);

  page.reload();
  await page.waitForSelector(
    'body > div.wpthemeFrame > main > div.main-banner-container > div.header-banner > div.container.menus-holder-container > div > ul > li.link.blue > a',
  );
  await page.click(
    'body > div.wpthemeFrame > main > div.main-banner-container > div.header-banner > div.container.menus-holder-container > div > ul > li.link.blue > a',
  );

  const frame = page.frameLocator('#loginFrame');
  await frame.locator('#username').fill(credentials.userCode);
  await frame.locator('#password').fill(credentials.password);

  // stale for random 0.5-1 second
  await sleep(Math.random() * 500 + 500);

  await Promise.all([page.waitForURL(/./), frame.locator('#continueBtn').click()]);

  const [response] = await Promise.all([
    page.waitForResponse(
      res => res.url().includes('/api/v1/accountSummary') && res.status() === 200,
    ),
  ]);

  const requestHeaders = response.request().headers();

  return requestHeaders;
}
