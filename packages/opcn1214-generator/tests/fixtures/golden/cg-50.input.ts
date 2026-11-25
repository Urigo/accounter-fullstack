/**
 * Golden `cg-50` (SPEC §13.5): record 1000, one shareholder and one capital-gains appendix for an
 * asset sale under betterment tax (record 3050) with every header member filled, the required
 * purchase date and code-15 date included, and every code of record 3050 (014 = 10, the rate 018
 * ×100); 833 and code 028 are derived from it (3050 has no "מספר בתל"ם" sequence). A frozen
 * literal: never import builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000090',
    registeredName: 'חברת נדל"ן השרון בע"מ',
    mailingAddress: 'רחוב ויצמן 30, כפר סבא',
    businessAddress: 'רחוב ויצמן 30, כפר סבא',
    phone: { prefix: '09', number: '7654321' },
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
  amounts: { '018': 4, '072': 0, '081': 540_000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '300000155',
      fullName: 'אבי גולדברג',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
  capitalGains: [
    {
      symbol: 50,
      expropriation: true,
      assetDetails: 'מגרש באזור תעשייה',
      purchaseDate: '2009-05-17',
      dates: { code15: '2024-09-01' },
      amounts: {
        '014': 10,
        '015': 2_400_000,
        '016': 1_100_000,
        '017': 85_000,
        '018': 50,
        '074': 30_000,
        '075': 20_000,
        '076': 15_000,
        '077': 5000,
      },
    },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
