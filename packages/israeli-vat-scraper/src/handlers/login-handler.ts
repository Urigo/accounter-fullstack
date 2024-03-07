import type { Page } from 'puppeteer';
import { waitForSelectorPlus } from '../utils/page-util.js';
import type { Logger, UserCredentials } from '../utils/types.js';

const _creds: UserCredentials = {
  vatNumber: '',
  userCode: '',
  userPass: '',
};

export const getEnvCredentials = (): UserCredentials => {
  return {
    vatNumber: process.env['VAT_NUM'] as string,
    userCode: process.env['USER_CODE'] as string,
    userPass: process.env['USER_PASS'] as string,
  };
};

export const updateCredentials = (credentials: UserCredentials): void => {
  _creds.vatNumber = credentials.vatNumber;
  _creds.userCode = credentials.userCode;
  _creds.userPass = credentials.userPass;
};

export const login = async (page: Page, logger: Logger): Promise<void> => {
  try {
    await page.goto('https://www.misim.gov.il/emdvhmfrt/wLogOnMaam.aspx', {
      waitUntil: ['networkidle2', 'domcontentloaded'],
    });
    await waitForSelectorPlus(page, '#LogonMaam1_EmTwbCtlLogonMaam_BtnSubmit', logger);

    await page.type('#LogonMaam1_EmTwbCtlLogonMaam_TxtMisOsek', _creds.vatNumber);

    await page.type('#LogonMaam1_EmTwbCtlLogonMaam_TxtKodUser', _creds.userCode);

    await page.type('#LogonMaam1_EmTwbCtlLogonMaam_TxtPassword', _creds.userPass);

    await page.click('#LogonMaam1_EmTwbCtlLogonMaam_BtnSubmit');

    return;
  } catch (e) {
    throw new Error(`login - ${(e as Error)?.message || e}`);
  }
};
