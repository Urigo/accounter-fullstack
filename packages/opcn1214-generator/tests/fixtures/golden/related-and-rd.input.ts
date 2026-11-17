/**
 * Golden `related-and-rd` (SPEC §13.5): record 1000 with code 165, three related companies (1010)
 * and five R&D investments (1030) whose total equals code 165. A frozen literal: never import
 * builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000017',
    registeredName: 'חברת אחזקות לדוגמה בע"מ',
    mailingAddress: 'רחוב רוטשילד 10, תל אביב',
    businessAddress: 'רחוב רוטשילד 10, תל אביב',
    phone: { prefix: '03', number: '7654321' },
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
  amounts: { '018': 4, '072': 0, '081': 2_500_000, '094': 0, '165': 1_750_000, '263': 1 },
  relatedCompanies: [
    {
      companyName: 'חברת האם בע"מ',
      companyFileNumber: '510000001',
      relationType: 'parent',
      assessingOfficeCode: 34,
    },
    {
      companyName: 'חברת הבת בע"מ',
      companyFileNumber: '510000002',
      relationType: 'subsidiary',
      assessingOfficeCode: 34,
    },
    { companyName: 'Foreign Affiliate Ltd', relationType: 'jointlyControlled' },
  ],
  shareholders: [
    {
      idNumber: '123456782',
      fullName: 'ישראל ישראלי',
      isControllingShareholder: true,
      dividendRightsPercent: 100,
    },
  ],
  rdInvestments: [
    { companyName: 'מו"פ ראשונה בע"מ', companyFileNumber: '520000001', investmentAmount: 500_000 },
    { companyName: 'מו"פ שנייה בע"מ', companyFileNumber: '520000002', investmentAmount: 400_000 },
    { companyName: 'מו"פ שלישית בע"מ', companyFileNumber: '520000003', investmentAmount: 350_000 },
    { companyName: 'מו"פ רביעית בע"מ', companyFileNumber: '520000004', investmentAmount: 300_000 },
    { companyName: 'R&D Start-up Ltd', investmentAmount: 200_000 },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
