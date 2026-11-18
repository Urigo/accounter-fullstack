/**
 * Golden `cg-63` (SPEC §13.5): record 1000, one shareholder and one capital-gains appendix for
 * securities under section 6 (record 3063) with every header member and every code filled; 833
 * and code 028 are derived from it. A frozen literal: never import builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000033',
    registeredName: 'חברת השקעות ערך בע"מ',
    mailingAddress: 'רחוב אחד העם 9, תל אביב',
    businessAddress: 'רחוב אחד העם 9, תל אביב',
    phone: { prefix: '03', number: '5101234' },
  },
  declarations: {
    hasTaxPlanningAction: false,
    hadRelatedPartyTransactions: false,
    controlsBodyOfPersons: false,
    holdsRightsInBodyOfPersons: false,
    appliesAccountingStandards: false,
    directorsReceivedOpinion: false,
    tookReportablePosition: false,
  },
  amounts: { '018': 4, '072': 0, '081': 480_000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '123456782',
      fullName: 'ישראל ישראלי',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
  capitalGains: [
    {
      symbol: 63,
      foreignAsset: true,
      lossesCarriedForward: 35_000,
      amounts: {
        '022': 250_000,
        '023': 180_000,
        '026': 12_500,
        '029': 8000,
        '056': 4200,
      },
    },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
