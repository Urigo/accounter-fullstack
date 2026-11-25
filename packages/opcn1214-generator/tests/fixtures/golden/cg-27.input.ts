/**
 * Golden `cg-27` (SPEC §13.5): record 1000, one shareholder and one capital-gains appendix for
 * shares (record 3027) with every header member filled, the three dates included, and every code
 * of record 3027 (020/053/027 with agorot, ×100; the rate 018 ×100); 833, code 028 and the
 * "מספר בתל"ם" sequence are derived from it. A frozen literal: never import builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000082',
    registeredName: 'חברת מניות הגליל בע"מ',
    mailingAddress: 'רחוב הרצל 5, נצרת עילית',
    businessAddress: 'רחוב הרצל 5, נצרת עילית',
    phone: { prefix: '04', number: '6012345' },
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
  amounts: { '018': 4, '072': 0, '081': 320_000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '300000148',
      fullName: 'רונית שפירא',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
  capitalGains: [
    {
      symbol: 27,
      expropriation: false,
      assetDetails: 'מניות בחברת תוכנה פרטית',
      assetLocation: 'abroad',
      relatedParty: true,
      buyerName: 'אחזקות צפון בע"מ',
      dates: { code15: '2024-07-14', code20: '2016-03-01', code53: '2012-11-20' },
      amounts: {
        '015': 450_000,
        '018': 23,
        '020': 125_430.75,
        '027': 3210.5,
        '053': 98_765.43,
        '055': 12_000,
        '057': 8000,
        '058': 4500,
        '074': 2500,
        '075': 1800,
        '076': 1200,
        '077': 600,
      },
    },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
