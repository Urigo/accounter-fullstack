/**
 * Golden `capital-gains-max` (SPEC §13.5): record 1000, one shareholder and the maximum of 14
 * capital-gains appendices (p.1, p.32), covering all ten appendix types (two 3027, two 3060 and
 * three 3077), given in mixed order. The file groups them by record type ascending; the appendix
 * number (30xx@139) counts per symbol, the "מספר בתל"ם" sequence (3027/3051/3065/3066/3077) across
 * all of them; 833, code 028 (= 14) and 9999@145 (= 14) are derived from them (SPEC §7.4, §15 A-7).
 * A frozen literal: never import builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000132',
    registeredName: 'חברת השקעות מגוונות בע"מ',
    mailingAddress: 'שדרות רוטשילד 40, תל אביב',
    businessAddress: 'שדרות רוטשילד 40, תל אביב',
    phone: { prefix: '03', number: '6543210' },
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
  amounts: { '018': 4, '072': 0, '081': 950_000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '300000197',
      fullName: 'דנה כהן',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
  capitalGains: [
    // 0 → 3077, appendix 1, sequence 12.
    {
      symbol: 77,
      expropriation: false,
      assetDetails: 'מבנה תעשייה',
      assetLocation: 'israel',
      relatedParty: false,
      buyerName: 'רוכש ראשון בע"מ',
      dates: { code15: '2024-04-10', code20: '2011-06-01' },
      improvements: [
        {
          expense: 50_000,
          accumulatedDepreciation: 5000,
          date: '2014-03-01',
          code50Amount: 45_000,
        },
      ],
      amounts: { '015': 1_800_000, '018': 23, '020': 650_000.5 },
    },
    // 1 → 3063, appendix 1, no sequence.
    {
      symbol: 63,
      foreignAsset: false,
      lossesCarriedForward: 3000,
      amounts: { '022': 40_000, '056': 2000 },
    },
    // 2 → 3027, appendix 1, sequence 1.
    {
      symbol: 27,
      expropriation: false,
      assetDetails: 'מניות בחברה פרטית',
      assetLocation: 'israel',
      relatedParty: false,
      buyerName: 'קרן השקעות בע"מ',
      dates: { code15: '2024-02-20', code20: '2018-01-10' },
      amounts: { '015': 300_000, '018': 23, '020': 120_000.25 },
    },
    // 3 → 3060, appendix 1, no sequence.
    {
      symbol: 60,
      foreignAsset: false,
      withholders: [{ name: 'בנק הפועלים בע"מ', branch: '600', account: '000412345' }],
      amounts: { '012': 55_000, '056': 2750 },
    },
    // 4 → 3051, appendix 1, sequence 4.
    {
      symbol: 51,
      assetDetails: 'מטבע וירטואלי אתריום',
      assetLocation: 'abroad',
      relatedParty: false,
      dates: { code15: '2024-12-31' },
      walletAddresses: ['0x9aF1e2bC3d4E5f60718293a4B5c6D7e8F9a0b1C2'],
      amounts: { '015': 70_000, '016': 52_000, '071': 1 },
    },
    // 5 → 3077, appendix 2, sequence 13.
    {
      symbol: 77,
      assetDetails: 'מטבע וירטואלי ביטקוין',
      assetLocation: 'abroad',
      dates: { code15: '2024-08-20', code20: '2020-05-05' },
      walletAddresses: ['bc1q9h7garjunvl0q7vaw0w4kz2wptxzksh6v4qne4'],
      amounts: { '015': 140_000, '071': 1, '074': 1200 },
    },
    // 6 → 3065, appendix 1, sequence 10.
    {
      symbol: 65,
      foreignAsset: false,
      withholdingStatus: 'notWithheldFirstHalf',
      amounts: { '012': 33_000, '056': 1650 },
    },
    // 7 → 3050, appendix 1, no sequence.
    {
      symbol: 50,
      assetDetails: 'דירת מגורים',
      purchaseDate: '2006-09-01',
      dates: { code15: '2024-06-30' },
      amounts: { '014': 20, '015': 1_950_000, '016': 1_200_000, '018': 50 },
    },
    // 8 → 3066, appendix 1, sequence 11.
    {
      symbol: 66,
      foreignAsset: true,
      withholdingStatus: 'notWithheldSecondHalf',
      amounts: { '022': 21_000, '056': 1050 },
    },
    // 9 → 3027, appendix 2, sequence 2.
    {
      symbol: 27,
      assetDetails: 'מניות בחברה זרה',
      assetLocation: 'abroad',
      dates: { code15: '2024-11-11' },
      amounts: { '015': 85_000, '074': 900 },
    },
    // 10 → 3054, appendix 1, no sequence.
    {
      symbol: 54,
      assetDetails: 'יחידות השתתפות בשותפות נפט',
      purchaseDate: '2019-04-04',
      dates: { code15: '2024-03-03' },
      amounts: { '015': 26_000, '016': 18_000 },
    },
    // 11 → 3064, appendix 1, no sequence.
    {
      symbol: 64,
      foreignAsset: false,
      gainFromInvestmentFund: true,
      amounts: { '013': 17_000, '056': 850 },
    },
    // 12 → 3060, appendix 2, no sequence.
    {
      symbol: 60,
      foreignAsset: true,
      soldToRelatedParty: false,
      withholders: [{ name: 'בנק לאומי לישראל', branch: '800', account: '123456789' }],
      lossesCarriedForward: 1500,
      amounts: { '012': 12_500, '056': 625 },
    },
    // 13 → 3077, appendix 3, sequence 14.
    {
      symbol: 77,
      expropriation: true,
      assetDetails: 'קרקע חקלאית',
      dates: { code15: '2024-01-15', code20: '1999-12-31' },
      improvements: [
        { expense: 20_000, date: '2005-07-07', code50Amount: 20_000 },
        { accumulatedDepreciation: 3000.5, date: '2010-10-10', code50Amount: 2999.5 },
      ],
      replacementAsset: { details: 'קרקע חלופית', purchaseDate: '2024-05-01', price: 900_000 },
      amounts: { '015': 1_100_000, '092': 2 },
    },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
