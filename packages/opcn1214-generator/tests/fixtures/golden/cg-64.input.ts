/**
 * Golden `cg-64` (SPEC §13.5): record 1000, one shareholder and one capital-gains appendix for a
 * real-estate investment trust (record 3064) with every header member filled, four withholding
 * agents included, and every code of record 3064; 833 and code 028 are derived from it. A frozen
 * literal: never import builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000058',
    registeredName: 'חברת נדל"ן מניב בע"מ',
    mailingAddress: 'רחוב יפו 97, ירושלים',
    businessAddress: 'רחוב יפו 97, ירושלים',
    phone: { prefix: '02', number: '6203456' },
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
  amounts: { '018': 4, '072': 0, '081': 360_000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '123456782',
      fullName: 'שרה לוי',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
  capitalGains: [
    {
      symbol: 64,
      foreignAsset: false,
      soldToRelatedParty: true,
      boughtFromRelatedParty: false,
      gainFromInvestmentFund: true,
      withholders: [
        { name: 'בנק מזרחי טפחות', branch: '461', account: '000556677' },
        { name: 'בנק הבינלאומי', branch: '034', account: '000112233' },
        { name: 'אלטשולר שחם', branch: '002', account: '700800900' },
        { name: 'בנק ירושלים', branch: '054', account: '000004321' },
      ],
      lossesCarriedForward: 18_500,
      amounts: {
        '013': 88_000,
        '033': 21_000,
        '056': 3150,
        '063': 9500,
        '085': 4400,
        '087': 1250,
      },
    },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
