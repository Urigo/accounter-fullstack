/**
 * Golden `cg-54` (SPEC §13.5): record 1000, one shareholder and one capital-gains appendix for an
 * oil-partnership asset (record 3054) with every header member filled, the required purchase date
 * and code-15 date included, and every code of record 3054 (016 = 0, which is zeroAllowed); 833
 * and code 028 are derived from it (3054 has no "מספר בתל"ם" sequence). A frozen literal: never
 * import builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000108',
    registeredName: 'חברת אנרגיה הים התיכון בע"מ',
    mailingAddress: 'שדרות ההגנה 7, אשדוד',
    businessAddress: 'שדרות ההגנה 7, אשדוד',
    phone: { prefix: '08', number: '8561234' },
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
  amounts: { '018': 4, '072': 0, '081': 260_000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '300000163',
      fullName: 'משה אלון',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
  capitalGains: [
    {
      symbol: 54,
      assetDetails: 'יחידות השתתפות בשותפות נפט',
      purchaseDate: '2019-02-28',
      dates: { code15: '2024-10-15' },
      amounts: {
        '015': 76_000,
        '016': 0,
        '074': 4200,
        '076': 1900,
      },
    },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
