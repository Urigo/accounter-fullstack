import type { Page } from 'puppeteer';
import { newPageByMonth } from '../utils/browser-util.js';
import { getReportExpansionFixes } from '../utils/evaluation-functions.js';
import { waitForSelectorPlus } from '../utils/page-util.js';
import type { Config, Logger, ReportFixedInvoice } from '../utils/types.js';
import { UserPrompt } from '../utils/user-prompt.js';

export class MonthFixesHandler {
  private config: Config;
  private prompt: UserPrompt;
  private location: string[];
  private index: number;
  private page: Page | null = null;

  constructor(config: Config, prompt: UserPrompt, location: string[], index: number) {
    this.config = config;
    this.prompt = prompt;
    this.location = [...location, 'Fixes'];
    this.index = index;
  }

  public handle = async (logger: Logger): Promise<ReportFixedInvoice[] | undefined> => {
    this.prompt.update(this.location, 'Fetching...', logger);
    try {
      this.page = await newPageByMonth(
        this.config.visibleBrowser,
        this.location[0] as string,
        this.index,
        logger,
      );

      const button = await this.page
        .waitForSelector('#ContentUsersPage_lnkHeshboniotBeforeTikun')
        .catch(() => {
          return;
        });

      if (!button) {
        this.prompt.update(this.location, 'Done - no data found', logger);
        return undefined;
      }

      await button.click();

      // get fixes
      const fixesTable = await waitForSelectorPlus(
        this.page,
        '#ContentUsersPage_DgIskNosfu',
        logger,
      );
      const fixes = (await fixesTable?.evaluate(getReportExpansionFixes)) ?? [];

      this.page.browser().close();

      this.prompt.update(this.location, 'Done', logger);
      return fixes;
    } catch (e) {
      this.prompt.addError(this.location, (e as Error)?.message || e, logger);
      this.page?.browser().close();
      return undefined;
    }
  };
}
