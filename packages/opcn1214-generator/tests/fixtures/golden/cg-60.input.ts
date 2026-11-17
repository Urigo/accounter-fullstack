/**
 * Golden `cg-60` (SPEC §13.5): record 1000, one shareholder and one capital-gains appendix for
 * securities (record 3060) with every header member filled, four withholding agents included, and
 * every code of record 3060; 833 and code 028 are derived from it. A frozen literal: never import
 * builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000041',
    registeredName: 'חברת ניירות ערך בע"מ',
    mailingAddress: 'שדרות רוטשילד 22, תל אביב',
    businessAddress: 'שדרות רוטשילד 22, תל אביב',
    phone: { prefix: '03', number: '5202345' },
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
  amounts: { '018': 4, '072': 0, '081': 520_000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '123456782',
      fullName: 'דוד כהן',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
  capitalGains: [
    {
      symbol: 60,
      foreignAsset: true,
      soldToRelatedParty: false,
      boughtFromRelatedParty: true,
      gainFromInvestmentFund: false,
      withholders: [
        { name: 'בנק הפועלים בע"מ', branch: '600', account: '000412345' },
        { name: 'בנק לאומי לישראל', branch: '800', account: '123456789' },
        { name: 'בנק דיסקונט', branch: '025', account: '000098765' },
        { name: 'מיטב בית השקעות', branch: '001', account: '500100200' },
      ],
      lossesCarriedForward: 42_000,
      amounts: {
        '010': 310_000,
        '012': 265_000,
        '013': 45_000,
        '030': 120_000,
        '032': 95_000,
        '033': 25_000,
        '034': 3000,
        '036': 2500,
        '044': 1800,
        '056': 6750,
        '060': 40_000,
        '062': 36_000,
        '063': 4000,
        '082': 1200,
        '084': 900,
        '085': 11_250,
        '086': 700,
        '087': 650,
        '089': 5400,
        '093': 2100,
        '099': 300,
      },
    },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
