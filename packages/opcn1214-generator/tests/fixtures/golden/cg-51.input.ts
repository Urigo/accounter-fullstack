/**
 * Golden `cg-51` (SPEC §13.5): record 1000, one shareholder and one capital-gains appendix for a
 * forced virtual-currency transaction (record 3051) with every header member filled, the required
 * code-15 date and two wallet addresses included, and every code of record 3051 (071 = 1 and 016
 * required); 833, code 028 and the "מספר בתל"ם" sequence are derived from it. A frozen literal:
 * never import builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000116',
    registeredName: 'חברת מטבעות דיגיטליים בע"מ',
    mailingAddress: 'רחוב רוטשילד 22, תל אביב',
    businessAddress: 'רחוב רוטשילד 22, תל אביב',
    phone: { prefix: '03', number: '5123456' },
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
  amounts: { '018': 4, '072': 0, '081': 180_000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '300000171',
      fullName: 'שירה בן דוד',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
  capitalGains: [
    {
      symbol: 51,
      assetDetails: 'מטבע וירטואלי ביטקוין',
      assetLocation: 'israel',
      relatedParty: false,
      buyerName: 'בורסת מטבעות דיגיטליים',
      dates: { code15: '2024-12-31' },
      walletAddresses: [
        'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      ],
      amounts: {
        '015': 210_000,
        '016': 145_000,
        '071': 1,
        '074': 3300,
        '076': 2100,
      },
    },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
