/**
 * Golden `minimal` (SPEC §13.5): record 1000 with only required fields and codes, one shareholder.
 * A frozen literal (the values of minimalInput() when the golden was created): never import
 * builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000009',
    registeredName: 'חברה לדוגמה בע"מ',
    mailingAddress: 'רחוב הרצל 1, תל אביב',
    businessAddress: 'רחוב הרצל 1, תל אביב',
    phone: { prefix: '03', number: '1234567' },
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
  amounts: { '018': 4, '072': 0, '081': 1000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '123456782',
      fullName: 'ישראל ישראלי',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
