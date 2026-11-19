/**
 * Golden `cg-77` (SPEC §13.5): record 1000, one shareholder and one capital-gains appendix for
 * other transactions (record 3077) with every header member filled: both required dates, five
 * improvements (expense and accumulated depreciation with agorot, ×100) each with its code-50
 * amount (codes 501–505, ×100), a replacement asset and two wallet addresses, and every input code
 * of record 3077 (071 = 1, the single-digit 092, the rate 018 ×100); 833, code 028, the improvement
 * count (245) and the "מספר בתל"ם" sequence are derived from it. A frozen literal: never import
 * builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000124',
    registeredName: 'חברת נכסים ומטבעות בע"מ',
    mailingAddress: 'רחוב הרצל 5, חיפה',
    businessAddress: 'רחוב הרצל 5, חיפה',
    phone: { prefix: '04', number: '8123456' },
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
  amounts: { '018': 4, '072': 0, '081': 420_000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '300000189',
      fullName: 'נועה אברהם',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
  capitalGains: [
    {
      symbol: 77,
      expropriation: false,
      assetDetails: 'מבנה משרדים ומטבע וירטואלי',
      assetLocation: 'israel',
      relatedParty: false,
      buyerName: 'רוכשי נכסים בע"מ',
      dates: { code15: '2024-10-15', code20: '2008-03-01' },
      improvements: [
        {
          expense: 120_000.5,
          accumulatedDepreciation: 24_000.25,
          date: '2010-05-01',
          code50Amount: 96_000.25,
        },
        {
          expense: 80_000,
          accumulatedDepreciation: 12_000.75,
          date: '2013-07-15',
          code50Amount: 67_999.25,
        },
        {
          expense: 45_500.4,
          accumulatedDepreciation: 4550,
          date: '2016-11-30',
          code50Amount: 40_950.4,
        },
        {
          expense: 30_000,
          accumulatedDepreciation: 1500.1,
          date: '2019-02-28',
          code50Amount: 28_499.9,
        },
        {
          expense: 15_000.99,
          accumulatedDepreciation: 300,
          date: '2022-09-01',
          code50Amount: 14_700.99,
        },
      ],
      replacementAsset: {
        details: 'מבנה משרדים חלופי',
        purchaseDate: '2024-12-01',
        price: 2_350_000,
      },
      walletAddresses: [
        'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      ],
      amounts: {
        '015': 2_900_000,
        '018': 23,
        '020': 1_100_000.5,
        '027': 1_250_000.75,
        '040': 85_000.25,
        '055': 12_000,
        '059': 3000,
        '071': 1,
        '072': 64_000,
        '074': 5200,
        '075': 1800,
        '076': 2600,
        '077': 900,
        '092': 1,
      },
    },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
