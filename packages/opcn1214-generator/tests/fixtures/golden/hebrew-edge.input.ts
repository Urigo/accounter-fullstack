/**
 * Golden `hebrew-edge` (SPEC §13.5): Hebrew text at its edges. Final letters (ך ם ן ף ץ), `בע"מ`
 * with an ASCII double quote, geresh and gershayim (׳ ״), Hebrew mixed with Latin and digits,
 * typographic quotes (normalized to ASCII, SPEC §4.3), a company name and a shareholder name at
 * exactly the full width (50), a buyer name at its full width (30) and addresses and asset
 * details near full width. No niqqud, no emoji, no invisible characters; every identifier passes
 * the check digit. A frozen literal: never import builders here.
 */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';

export const input: Report1214Input = {
  taxYear: 2024,
  meta: { softwareName: 'ACCOUNTER', saveDate: '2025-03-31' },
  company: {
    fileNumber: '512345679',
    // 50 characters: the full width of 1000@175.
    registeredName: 'אחים כ״ץ ושות׳ - מערכות תוכנה מתקדמות (ישראל) בע"מ',
    occupationDescription: 'פיתוח SaaS ו-AI לניהול מס, גרסה 2.0',
    // 49 of 50 characters.
    mailingAddress: 'רח׳ ז׳בוטינסקי 155, קומה 1, רמת גן 5252006, ת"ד 7',
    businessAddress: 'מגדל "אלון" - דרך מנחם בגין 132, תל אביב-יפו',
    phone: { prefix: '03', number: '6123456' },
  },
  preparer: {
    // Typographic quotes become ASCII '"' (SPEC §4.3).
    officeName: '“משרד כהן ושות׳” רואי חשבון',
    name: 'יוסף נחום-אלוף',
    licensedDealerNumber: '333333334',
  },
  declarations: {
    hasTaxPlanningAction: false,
    hadRelatedPartyTransactions: true,
    controlsBodyOfPersons: true,
    holdsRightsInBodyOfPersons: false,
    appliesAccountingStandards: false,
    directorsReceivedOpinion: false,
    tookReportablePosition: false,
  },
  otherTaxableIncome: { source: 'שכ"ד מנכס ברח׳ הנשיא 7, חיפה', amount: 48_000 },
  amounts: { '018': 4, '072': 0, '081': 250_000, '094': 0, '165': 75_000, '263': 1 },
  relatedCompanies: [
    {
      companyName: 'קבוצת ענף וזך בע"מ',
      companyFileNumber: '587654328',
      relationType: 'subsidiary',
    },
  ],
  shareholders: [
    {
      idNumber: '123456782',
      // 50 characters: the full width of 1020@148.
      fullName: 'אברהם בן-צבי מלך ענף זך שמעון פרץ כ״ץ רוף חנה לוין',
      isControllingShareholder: true,
      dividendRightsPercent: 50,
    },
    {
      idNumber: '314159260',
      fullName: 'ג׳ורג׳ ד׳אמיקו',
      isControllingShareholder: false,
      dividendRightsPercent: 30,
    },
    {
      idNumber: '271828188',
      fullName: "צ׳רלי O'Brien-גולדשטיין 3",
      isControllingShareholder: false,
      dividendRightsPercent: 20,
    },
  ],
  rdInvestments: [
    {
      companyName: 'מו"פ טכנולוגיות 2024 בע"מ',
      companyFileNumber: '524680139',
      investmentAmount: 75_000,
    },
  ],
  capitalGains: [
    {
      symbol: 27,
      // 46 of 50 characters.
      assetDetails: 'מניות "אלף-בית" בע"מ (ני"ע) - 1,000 יח׳ רגילות',
      assetLocation: 'israel',
      // 30 characters: the full width of 3027@195.
      buyerName: 'רוכש ני"ע בע"מ - סניף צפון 123',
      dates: { code15: '2024-11-17' },
      amounts: { '015': 120_000, '018': 23 },
    },
  ],
};

export const options: GenerateOptions = { today: () => '2025-03-31' };
