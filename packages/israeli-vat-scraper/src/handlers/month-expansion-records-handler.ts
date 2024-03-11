import type { Page } from 'puppeteer';
import { newPageByMonth } from '../utils/browser-util.js';
import {
  getReportExpansionInputRecordDetails,
  getReportExpansionInputRecords,
} from '../utils/evaluation-functions.js';
import { waitAndClick, waitForSelectorPlus } from '../utils/page-util.js';
import type {
  Config,
  Logger,
  ReportInputRecord,
  ReportInputRecordDetails,
} from '../utils/types.js';
import { UserPrompt } from '../utils/user-prompt.js';

export class monthExpansionRecordsHandler {
  private config: Config;
  private prompt: UserPrompt;
  private location: string[];
  private tabSelector: string;
  private page: Page | null = null;
  private index: number;
  private secondaryIndex: number;

  constructor(
    config: Config,
    prompt: UserPrompt,
    location: string[],
    tabSelector: string,
    index: number,
    secondaryIndex: number,
  ) {
    this.config = config;
    this.prompt = prompt;
    this.location = [...location, 'Records'];
    this.tabSelector = tabSelector;
    this.index = index;
    this.secondaryIndex = secondaryIndex;
  }

  public handle = async (logger: Logger): Promise<ReportInputRecord[]> => {
    try {
      this.prompt.update(this.location, 'Fetching', logger);

      this.page = await newPageByMonth(
        this.config.visibleBrowser,
        this.location[0] as string,
        this.index,
        logger,
      );

      await waitAndClick(this.page, this.tabSelector, logger);

      await waitAndClick(
        this.page,
        `#tblSikum > tbody > tr:nth-child(${this.index}) > td:nth-child(${this.secondaryIndex}) > a`,
        logger,
      );

      const recordsTable = await waitForSelectorPlus(this.page, '#dgHeshboniot', logger);
      const records = (await recordsTable?.evaluate(getReportExpansionInputRecords)) ?? [];

      this.prompt.update(this.location, 'Fetching details', logger);
      for (let i = 0; i < records.length; i++) {
        const details = await this.getRecordDetails(i, logger);
        if (!details) {
          throw new Error(`Failed to fetch details for record ${i + 1} of ${records.length}`);
        }
        records[i]!.details = details;
      }

      await waitAndClick(this.page, '#btnGoBack', logger);
      this.prompt.update(this.location, 'Done', logger);
      return records;
    } catch (e) {
      this.prompt.addError(this.location, (e as Error)?.message || e, logger);
      return [];
    }
  };

  private getRecordDetails = async (
    index: number,
    logger: Logger,
  ): Promise<ReportInputRecordDetails | undefined> => {
    try {
      if (!this.page) {
        this.page = await newPageByMonth(
          this.config.visibleBrowser,
          this.location[0] as string,
          this.index,
          logger,
        );

        await waitAndClick(this.page, this.tabSelector, logger);

        const button = await waitForSelectorPlus(
          this.page,
          `#tblSikum > tbody > tr:nth-child(${this.index}) > td:nth-child(${this.secondaryIndex}) > a`,
          logger,
        );
        if (!button) {
          return undefined;
        }
        await button.click();
      }

      await waitAndClick(
        this.page,
        `#ContentUsersPage_dgHeshboniot_btnPratimNosafim_${index}`,
        logger,
      );

      const detailsTable = await waitForSelectorPlus(
        this.page,
        '#ContentUsersPage_ucPratimNosafimHsb1_TblPerutHeshbonit',
        logger,
      );

      const details = await detailsTable?.evaluate(getReportExpansionInputRecordDetails);

      await waitAndClick(this.page, '#BtnCloseDlgPrtNsf', logger);
      return details;
    } catch (e) {
      this.prompt.addError([...this.location, 'Details'], (e as Error)?.message || e, logger);
      return undefined;
    }
  };
}
