/**
 * Golden `foreign` (SPEC §13.5): record 1000, one shareholder and the foreign appendix (record 2000)
 * with every per-country code written, each broken down by country in its own 2200 record: ten
 * countries for code 420 and the "country unknown" code -88 for code 439 (SPEC §3.6). A frozen
 * literal: never import builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000025',
    registeredName: 'חברת סחר בינלאומי בע"מ',
    mailingAddress: 'דרך מנחם בגין 132, תל אביב',
    businessAddress: 'דרך מנחם בגין 132, תל אביב',
    phone: { prefix: '03', number: '6091234' },
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
  amounts: { '018': 4, '072': 0, '081': 250_000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '123456782',
      fullName: 'ישראל ישראלי',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
  foreignAppendix: {
    otherTaxableIncomeDescription: 'תמלוגים מחו"ל',
    otherTaxableIncome: 40_000,
    foreignTaxPaidOnOtherIncome: 6000,
    totalForeignTaxableIncome: 520_000,
    totalForeignLoss: 15_000,
    participationExemptionHoldingCompany: 7000,
    taxRefundDeclaration: true,
    taxRefundDeclarationAmount: 2500,
    amounts: {
      '401': 80_000,
      '416': 1000,
      '417': 4100,
      '420': 550_000,
      '423': 8100,
      '424': 5000,
      '425': 12_345,
      '426': 12_100,
      '427': 7000,
      '430': 16_100,
      '431': 9000,
      '432': 20_100,
      '433': 11_000,
      '436': 24_100,
      '437': 13_000,
      '438': 28_100,
      '439': 20_000,
      '442': 32_100,
      '443': 17_000,
      '445': 36_100,
      '447': 19_000,
      '450': 40_100,
      '454': 21_000,
      '458': 44_100,
      '461': 23_000,
    },
    countryBreakdown: {
      '416': {
        deductionsOffsetsAndExemptions: 500,
        countries: [{ country: '826', income: 1000 }],
      },
      '417': {
        countries: [
          { country: '276', income: 2000 },
          { country: '250', income: 2100 },
        ],
      },
      '420': {
        deductionsOffsetsAndExemptions: 15_000,
        countries: [
          { country: '840', income: 10_000 },
          { country: '826', income: 20_000 },
          { country: '276', income: 30_000 },
          { country: '250', income: 40_000 },
          { country: '528', income: 50_000 },
          { country: '196', income: 60_000 },
          { country: '756', income: 70_000 },
          { country: '124', income: 80_000 },
          { country: '392', income: 90_000 },
          { country: '372', income: 100_000 },
        ],
      },
      '423': {
        deductionsOffsetsAndExemptions: 2000,
        countries: [
          { country: '528', income: 4000 },
          { country: '196', income: 4100 },
        ],
      },
      '424': {
        countries: [{ country: '756', income: 5000 }],
      },
      '426': {
        countries: [
          { country: '124', income: 6000 },
          { country: '392', income: 6100 },
        ],
      },
      '427': {
        deductionsOffsetsAndExemptions: 3500,
        countries: [{ country: '372', income: 7000 }],
      },
      '430': {
        countries: [
          { country: '040', income: 8000 },
          { country: '380', income: 8100 },
        ],
      },
      '431': {
        countries: [{ country: '724', income: 9000 }],
      },
      '432': {
        deductionsOffsetsAndExemptions: 5000,
        countries: [
          { country: '442', income: 10_000 },
          { country: '056', income: 10_100 },
        ],
      },
      '433': {
        countries: [{ country: '702', income: 11_000 }],
      },
      '436': {
        countries: [
          { country: '036', income: 12_000 },
          { country: '356', income: 12_100 },
        ],
      },
      '437': {
        deductionsOffsetsAndExemptions: 6500,
        countries: [{ country: '752', income: 13_000 }],
      },
      '438': {
        countries: [
          { country: '208', income: 14_000 },
          { country: '826', income: 14_100 },
        ],
      },
      '439': {
        countries: [
          { country: '-88', income: 12_000 },
          { country: '840', income: 8000 },
        ],
      },
      '442': {
        deductionsOffsetsAndExemptions: 8000,
        countries: [
          { country: '276', income: 16_000 },
          { country: '250', income: 16_100 },
        ],
      },
      '443': {
        countries: [{ country: '528', income: 17_000 }],
      },
      '445': {
        countries: [
          { country: '196', income: 18_000 },
          { country: '756', income: 18_100 },
        ],
      },
      '447': {
        deductionsOffsetsAndExemptions: 9500,
        countries: [{ country: '124', income: 19_000 }],
      },
      '450': {
        countries: [
          { country: '392', income: 20_000 },
          { country: '372', income: 20_100 },
        ],
      },
      '454': {
        countries: [{ country: '040', income: 21_000 }],
      },
      '458': {
        deductionsOffsetsAndExemptions: 11_000,
        countries: [
          { country: '380', income: 22_000 },
          { country: '724', income: 22_100 },
        ],
      },
      '461': {
        countries: [{ country: '442', income: 23_000 }],
      },
    },
  },
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
