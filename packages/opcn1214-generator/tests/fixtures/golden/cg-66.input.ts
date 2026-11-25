/**
 * Golden `cg-66` (SPEC §13.5): record 1000, one shareholder and one capital-gains appendix for
 * securities without withholding, form 1326 (record 3066) with every header member filled, the
 * withholding status included, and every code of record 3066; 833, code 028 and the "מספר בתל"ם"
 * sequence are derived from it. A frozen literal: never import builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000074',
    registeredName: 'חברת השקעות הנגב בע"מ',
    mailingAddress: 'שדרות רגר 40, באר שבע',
    businessAddress: 'שדרות רגר 40, באר שבע',
    phone: { prefix: '08', number: '6204567' },
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
  amounts: { '018': 4, '072': 0, '081': 150_000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '300000130',
      fullName: 'מרים אברהם',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
  capitalGains: [
    {
      symbol: 66,
      foreignAsset: false,
      withholdingStatus: 'notWithheldFirstHalf',
      lossesCarriedForward: 9600,
      amounts: {
        '022': 64_000,
        '023': 15_500,
        '026': 3200,
        '029': 1100,
        '056': 2400,
      },
    },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
