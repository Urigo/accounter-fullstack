/**
 * Golden `batch-50` (SPEC §13.5): an OPCN batch of 50 minimal reports (record 1000 with only
 * required fields and codes, one shareholder), generated with generate1214Batch. The reports differ
 * only in their file numbers, all distinct with a valid check digit. A frozen literal: never import
 * builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

/** The file number of each report, in batch order. */
const FILE_NUMBERS = [
  '514010016',
  '514010024',
  '514010032',
  '514010040',
  '514010057',
  '514010065',
  '514010073',
  '514010081',
  '514010099',
  '514010107',
  '514010115',
  '514010123',
  '514010131',
  '514010149',
  '514010156',
  '514010164',
  '514010172',
  '514010180',
  '514010198',
  '514010206',
  '514010214',
  '514010222',
  '514010230',
  '514010248',
  '514010255',
  '514010263',
  '514010271',
  '514010289',
  '514010297',
  '514010305',
  '514010313',
  '514010321',
  '514010339',
  '514010347',
  '514010354',
  '514010362',
  '514010370',
  '514010388',
  '514010396',
  '514010404',
  '514010412',
  '514010420',
  '514010438',
  '514010446',
  '514010453',
  '514010461',
  '514010479',
  '514010487',
  '514010495',
  '514010503',
] as const;

export const inputs: Report1214Input[] = FILE_NUMBERS.map(fileNumber => ({
  taxYear: 2024,
  company: {
    fileNumber,
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
}));

export const options: GenerateOptions = { today: () => '2025-03-31' };
