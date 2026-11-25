/**
 * Golden `kibbutz` (SPEC §13.5): a kibbutz (1000@877) with code 226 = 1 and no shareholders, so the
 * 9999 record counts 00 shareholder records (struct.shareholders.min allows none for a kibbutz). A
 * frozen literal: never import builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '570000018',
    registeredName: 'קיבוץ לדוגמה אגודה שיתופית',
    mailingAddress: 'קיבוץ לדוגמה, ד.נ. גליל',
    businessAddress: 'קיבוץ לדוגמה, ד.נ. גליל',
    phone: { prefix: '04', number: '6900000' },
  },
  declarations: {
    hasTaxPlanningAction: false,
    hadRelatedPartyTransactions: false,
    controlsBodyOfPersons: false,
    holdsRightsInBodyOfPersons: false,
    appliesAccountingStandards: false,
    directorsReceivedOpinion: false,
    tookReportablePosition: false,
    isKibbutz: true,
  },
  amounts: { '018': 4, '072': 0, '081': 250_000, '094': 0, '226': 1, '263': 1 },
  shareholders: [],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
