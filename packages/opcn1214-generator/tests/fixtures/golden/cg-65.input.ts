/**
 * Golden `cg-65` (SPEC §13.5): record 1000, one shareholder and one capital-gains appendix for
 * securities without withholding, form 1322 (record 3065) with every header member filled, the
 * withholding status and four withholding agents included, and 20 of the 21 codes of record 3065,
 * the most SHAAM accepts in one appendix (cg.codePairs.max; code 099 left out in FIX-2); 833, code
 * 028 and the "מספר בתל"ם" sequence are derived from it. A frozen literal: never import
 * builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000066',
    registeredName: 'חברת אחזקות ניירות בע"מ',
    mailingAddress: 'רחוב הנמל 12, חיפה',
    businessAddress: 'רחוב הנמל 12, חיפה',
    phone: { prefix: '04', number: '8203456' },
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
  amounts: { '018': 4, '072': 0, '081': 410_000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '300000122',
      fullName: 'יוסף מזרחי',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
  capitalGains: [
    {
      symbol: 65,
      foreignAsset: true,
      soldToRelatedParty: false,
      boughtFromRelatedParty: true,
      gainFromInvestmentFund: false,
      withholdingStatus: 'notWithheldSecondHalf',
      withholders: [
        { name: 'בנק אגוד לישראל', branch: '013', account: '000765432' },
        { name: 'בנק מסד', branch: '502', account: '000011223' },
        { name: 'פסגות בית השקעות', branch: '003', account: '400300200' },
        { name: 'בנק יהב', branch: '120', account: '000909090' },
      ],
      lossesCarriedForward: 27_500,
      amounts: {
        '010': 210_000,
        '012': 180_000,
        '013': 30_000,
        '030': 90_000,
        '032': 72_000,
        '033': 18_000,
        '034': 2200,
        '036': 1900,
        '044': 1400,
        '056': 4500,
        '060': 26_000,
        '062': 23_500,
        '063': 2500,
        '082': 800,
        '084': 650,
        '085': 7500,
        '086': 450,
        '087': 400,
        '089': 3600,
        '093': 1500,
      },
    },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
