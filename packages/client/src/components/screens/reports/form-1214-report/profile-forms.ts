import { z } from 'zod';
import {
  Report1214ConsolidatedReport,
  Report1214Form6111Obligation,
  type Report1214CompanyOverridesInput,
  type Report1214DeclarationsInput,
  type Report1214PhoneInput,
  type Report1214PreparerInput,
} from '../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../helpers/index.js';

/**
 * Pure conversions between the form 1214 profile blocks (as the API reads them back) and the
 * state of the company, preparer and declarations editors, plus the editors' client-side checks.
 *
 * Text form state uses `''` for "not set"; on save every empty value becomes `null` (or is left out),
 * and a block with nothing set is sent as `null`, which clears it. Profile updates replace a whole
 * block, so each editor always sends its complete block.
 */

/**
 * Phone prefixes form 1214 allows. The server keeps the same list (`REPORT_1214_PHONE_PREFIXES` in
 * the report-1214 module) and rejects anything else.
 */
export const FORM_1214_PHONE_PREFIXES = [
  '02',
  '03',
  '04',
  '08',
  '09',
  '050',
  '052',
  '053',
  '054',
  '055',
  '057',
  '058',
  '059',
  '072',
  '073',
  '074',
  '076',
  '077',
] as const;

/** A phone as the API reads it back. */
type PhoneValue = { prefix: string; number: string } | null | undefined;

export type PhoneFormState = { prefix: string; number: string };

function text(value: string | null | undefined): string {
  return value ?? '';
}

/** Trimmed text, or `null` when empty. */
export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function phoneToForm(phone: PhoneValue): PhoneFormState {
  return { prefix: text(phone?.prefix), number: text(phone?.number) };
}

/** A phone with both parts empty → `null`; otherwise both parts (the server checks them). */
export function phoneFormToInput(phone: PhoneFormState): Report1214PhoneInput | null {
  const prefix = emptyToNull(phone.prefix);
  const number = emptyToNull(phone.number);
  if (prefix === null && number === null) {
    return null;
  }
  return { prefix: prefix ?? '', number: number ?? '' };
}

/** Removes the `null` members; `null` when nothing is left. */
function nullWhenEmpty<T extends object>(block: T): T | null {
  const entries = Object.entries(block).filter(([, value]) => value !== null);
  return entries.length === 0 ? null : (Object.fromEntries(entries) as T);
}

const phoneSchema = z
  .object({ prefix: z.string(), number: z.string() })
  .superRefine((phone, ctx) => {
    const prefix = phone.prefix.trim();
    const number = phone.number.trim();
    if (!prefix && !number) {
      return;
    }
    if (!(FORM_1214_PHONE_PREFIXES as readonly string[]).includes(prefix)) {
      ctx.addIssue({ code: 'custom', path: ['prefix'], message: 'Choose a prefix' });
    }
    if (!/^\d{7}$/.test(number)) {
      ctx.addIssue({ code: 'custom', path: ['number'], message: 'Exactly 7 digits' });
    }
  });

const optionalDigits = (max: number) =>
  z
    .string()
    .refine(value => value.trim() === '' || new RegExp(`^\\d{1,${max}}$`).test(value.trim()), {
      message: `Up to ${max} digits`,
    });

const optionalText = z.string().max(200, { message: 'At most 200 characters' });

// ---------------------------------------------------------------------------------------------
// Company overrides
// ---------------------------------------------------------------------------------------------

/** The company overrides as the API reads them back. */
export type CompanyOverridesValue = {
  registeredName?: string | null;
  phone?: PhoneValue;
  fax?: PhoneValue;
  email?: string | null;
  occupationDescription?: string | null;
  mailingAddress?: string | null;
  businessAddress?: string | null;
  booksAddress?: string | null;
  withholdingFileNumber?: string | null;
};

export const companyFormSchema = z.object({
  registeredName: optionalText,
  phone: phoneSchema,
  fax: phoneSchema,
  email: optionalText.refine(
    value => value.trim() === '' || z.email().safeParse(value.trim()).success,
    { message: 'Not a valid email address' },
  ),
  occupationDescription: optionalText,
  mailingAddress: optionalText,
  businessAddress: optionalText,
  booksAddress: optionalText,
  withholdingFileNumber: optionalDigits(9),
});

export type CompanyFormState = z.infer<typeof companyFormSchema>;

export function companyToForm(company: CompanyOverridesValue | null | undefined): CompanyFormState {
  return {
    registeredName: text(company?.registeredName),
    phone: phoneToForm(company?.phone),
    fax: phoneToForm(company?.fax),
    email: text(company?.email),
    occupationDescription: text(company?.occupationDescription),
    mailingAddress: text(company?.mailingAddress),
    businessAddress: text(company?.businessAddress),
    booksAddress: text(company?.booksAddress),
    withholdingFileNumber: text(company?.withholdingFileNumber),
  };
}

/** The whole `company` block to save; `null` (clear) when no override is set. */
export function companyFormToInput(form: CompanyFormState): Report1214CompanyOverridesInput | null {
  return nullWhenEmpty<Report1214CompanyOverridesInput>({
    registeredName: emptyToNull(form.registeredName),
    phone: phoneFormToInput(form.phone),
    fax: phoneFormToInput(form.fax),
    email: emptyToNull(form.email),
    occupationDescription: emptyToNull(form.occupationDescription),
    mailingAddress: emptyToNull(form.mailingAddress),
    businessAddress: emptyToNull(form.businessAddress),
    booksAddress: emptyToNull(form.booksAddress),
    withholdingFileNumber: emptyToNull(form.withholdingFileNumber),
  });
}

// ---------------------------------------------------------------------------------------------
// Preparer
// ---------------------------------------------------------------------------------------------

/** The preparer as the API reads it back. */
export type PreparerValue = {
  officeName?: string | null;
  contactName?: string | null;
  name?: string | null;
  profession?: string | null;
  licensedDealerNumber?: string | null;
  address?: string | null;
  phone?: PhoneValue;
};

export const preparerFormSchema = z.object({
  officeName: optionalText,
  contactName: optionalText,
  name: optionalText,
  profession: optionalText,
  licensedDealerNumber: optionalDigits(9),
  address: optionalText,
  phone: phoneSchema,
});

export type PreparerFormState = z.infer<typeof preparerFormSchema>;

export function preparerToForm(preparer: PreparerValue | null | undefined): PreparerFormState {
  return {
    officeName: text(preparer?.officeName),
    contactName: text(preparer?.contactName),
    name: text(preparer?.name),
    profession: text(preparer?.profession),
    licensedDealerNumber: text(preparer?.licensedDealerNumber),
    address: text(preparer?.address),
    phone: phoneToForm(preparer?.phone),
  };
}

/** The whole `preparer` block to save; `null` (clear) when every field is empty. */
export function preparerFormToInput(form: PreparerFormState): Report1214PreparerInput | null {
  return nullWhenEmpty<Report1214PreparerInput>({
    officeName: emptyToNull(form.officeName),
    contactName: emptyToNull(form.contactName),
    name: emptyToNull(form.name),
    profession: emptyToNull(form.profession),
    licensedDealerNumber: emptyToNull(form.licensedDealerNumber),
    address: emptyToNull(form.address),
    phone: phoneFormToInput(form.phone),
  });
}

// ---------------------------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------------------------

/** A yes/no answer that may still be open. */
export type TriState = 'yes' | 'no' | '';

export function booleanToTriState(value: boolean | null | undefined): TriState {
  if (value == null) {
    return '';
  }
  return value ? 'yes' : 'no';
}

export function triStateToBoolean(value: TriState): boolean | null {
  if (value === '') {
    return null;
  }
  return value === 'yes';
}

type DeclarationField = {
  key: string;
  /** Field number(s) on the form (record 1000 positions). */
  field: string;
  label: string;
  /** The form's wording, verbatim from the generator's layout (`nameHe`). */
  labelHe: string;
};

/** The 7 yes/no declarations every report must answer. */
export const REQUIRED_DECLARATIONS = [
  {
    key: 'hasTaxPlanningAction',
    field: '878',
    label: 'The company took a tax planning action',
    labelHe: 'קיימת פעולת תכנון מס',
  },
  {
    key: 'hadRelatedPartyTransactions',
    field: '879',
    label: 'The company had transactions with related parties',
    labelHe: 'סימון לחברה היו עסקאות עם צדדים קשורים',
  },
  {
    key: 'controlsBodyOfPersons',
    field: '880',
    label: 'The company controls a body of persons',
    labelHe: 'החברה בעלת שליטה בחבר בני אדם',
  },
  {
    key: 'holdsRightsInBodyOfPersons',
    field: '881',
    label: 'The company holds rights in a body of persons',
    labelHe: 'החברה בעלת זכויות בחבר בני אדם',
  },
  {
    key: 'appliesAccountingStandards',
    field: '882',
    label: 'The company applies accounting standards',
    labelHe: 'סימון תקנים חשבונאים',
  },
  {
    key: 'directorsReceivedOpinion',
    field: '1029',
    label: "Directors' declaration: the company received an opinion",
    labelHe: 'הצהרת מנהלי החברה – החברה קבלה "חוות דעת"',
  },
  {
    key: 'tookReportablePosition',
    field: '1030',
    label: 'The company took a reportable position',
    labelHe: 'החברה נקטה בעמדה חייבת בדיווח',
  },
] as const satisfies readonly DeclarationField[];

/** Optional declarations the form answers yes or no (blank when not answered). */
export const OPTIONAL_YES_NO_DECLARATIONS = [
  {
    key: 'requestsAdvancePayments',
    field: '883',
    label: 'The company requests advance payments',
    labelHe: 'סימון החברה דורשת מקדמות',
  },
  {
    key: 'hasBuildingIncome',
    field: '884',
    label: 'The company has income from a building',
    labelHe: 'לחברה יש הכנסות מבניין',
  },
  {
    key: 'partOfMultinationalGroup',
    field: '1033',
    label: 'The company is part of a multinational group',
    labelHe: 'סימון החברה היא חלק מקבוצה רב לאומית',
  },
] as const satisfies readonly DeclarationField[];

/** Optional declarations the form only marks (checked = marked, unchecked = left blank). */
export const OPTIONAL_FLAG_DECLARATIONS = [
  {
    key: 'financialStatementsAttached',
    field: '835',
    label: 'Financial statements and reconciliation report attached',
    labelHe: 'סימון צורפו לדו"ח דוחות כספיים ודו"ח התאמה',
  },
  {
    key: 'isHouseCompany',
    field: '846',
    label: 'House company',
    labelHe: 'סימון חברת בית',
  },
  {
    key: 'form1343Attached',
    field: '847',
    label: 'Form 1343 attached',
    labelHe: 'סימון טופס – 1343',
  },
  {
    key: 'form1344Attached',
    field: '848',
    label: 'Form 1344 attached',
    labelHe: 'סימון טופס – 1344',
  },
  {
    key: 'claimsCapitalInvestmentLawBenefits',
    field: '849',
    label: 'Claims benefits under the Law for the Encouragement of Capital Investments',
    labelHe: 'סימון נתבעות הטבות לפי חוק לעידוד השקעות הון',
  },
  {
    key: 'preferredEnterprise',
    field: '850',
    label: 'Preferred enterprise',
    labelHe: 'סימון במפעל מועדף',
  },
  {
    key: 'dividendDistributed',
    field: '862',
    label: 'Dividend distributed',
    labelHe: 'סימון חולק דיבידנד',
  },
  {
    key: 'foreignInvestors',
    field: '874',
    label: 'Foreign investors',
    labelHe: 'סימון משקיעי חוץ',
  },
  {
    key: 'partnerInPartnership',
    field: '876',
    label: 'The company is a partner in a partnership',
    labelHe: 'סימון התאגיד שותף בשותפות',
  },
  {
    key: 'isKibbutz',
    field: '877',
    label: 'Kibbutz',
    labelHe: 'סימון קיבוץ',
  },
  {
    key: 'isTrustBeneficiary',
    field: '886',
    label: 'The company is a trust beneficiary',
    labelHe: 'סימון החברה היא נהנה בנאמנות',
  },
  {
    key: 'nonDeductibleSalaryExpenses',
    field: '1031',
    label: 'There are salary expenses not allowed as a deduction',
    labelHe: 'סימון קיימות הוצאות שכר שלא מותרות בניכוי',
  },
  {
    key: 'fewMembersCompany62A',
    field: '1032',
    label: 'Company of few members (section 62A)',
    labelHe: "סימון חברת מעטים לפי סעיף 62א'",
  },
  {
    key: 'noBankAccount',
    field: '1064',
    label: 'The company has no bank account',
    labelHe: 'סימון – לא קיים חשבון בנק',
  },
  {
    key: 'hasCapitalGainsAppendix',
    field: '833',
    label:
      'Force "capital-gains appendix exists" (otherwise derived from the appendices and the untransmitted count)',
    labelHe: 'קיים נספח רווח הון',
  },
] as const satisfies readonly DeclarationField[];

export type RequiredDeclarationKey = (typeof REQUIRED_DECLARATIONS)[number]['key'];
export type OptionalYesNoDeclarationKey = (typeof OPTIONAL_YES_NO_DECLARATIONS)[number]['key'];
export type FlagDeclarationKey = (typeof OPTIONAL_FLAG_DECLARATIONS)[number]['key'];
type TriStateKey = RequiredDeclarationKey | OptionalYesNoDeclarationKey;

export const FORM_6111_OBLIGATION_OPTIONS = [
  {
    value: Report1214Form6111Obligation.Obliged,
    label: 'Turnover above the threshold: must file form 6111',
  },
  { value: Report1214Form6111Obligation.NotObliged, label: 'Not obliged to file form 6111' },
  { value: Report1214Form6111Obligation.NotRelevant, label: 'Not relevant' },
] as const;

export const CONSOLIDATED_REPORT_OPTIONS = [
  {
    value: Report1214ConsolidatedReport.ConsolidatedUnderSection_23,
    label: 'This report is consolidated under section 23',
  },
  {
    value: Report1214ConsolidatedReport.ConsolidatesWithParent,
    label: 'The company consolidates with its parent',
  },
  { value: Report1214ConsolidatedReport.NotRelevant, label: 'Not relevant' },
] as const;

/** Reportable positions the form has room for; more can be saved, the report validation flags it. */
export const FORM_1214_MAX_REPORTABLE_POSITIONS = 5;

/** The declarations as the API reads them back. */
export type DeclarationsValue = Partial<
  Record<TriStateKey | FlagDeclarationKey, boolean | null>
> & {
  reportablePositions?: readonly number[] | null;
  form6111Obligation?: Report1214Form6111Obligation | null;
  consolidatedReport?: Report1214ConsolidatedReport | null;
  familyCompany?: { representativeFileNumber: string } | null;
  beneficiaryEnterprise?: { noticeDate: TimelessDateString } | null;
  specialYear?: { balanceSheetDate: TimelessDateString } | null;
};

const triStateSchema = z.enum(['yes', 'no', '']);
const dateSchema = z.string();

export const declarationsFormSchema = z
  .object({
    answers: z.record(z.string(), triStateSchema),
    flags: z.record(z.string(), z.boolean()),
    form6111Obligation: z.union([z.enum(Report1214Form6111Obligation), z.literal('')]),
    consolidatedReport: z.union([z.enum(Report1214ConsolidatedReport), z.literal('')]),
    isFamilyCompany: z.boolean(),
    representativeFileNumber: z.string(),
    isBeneficiaryEnterprise: z.boolean(),
    beneficiaryNoticeDate: dateSchema,
    isSpecialYear: z.boolean(),
    specialYearBalanceSheetDate: dateSchema,
    reportablePositions: z.array(z.object({ value: z.string() })),
  })
  .superRefine((form, ctx) => {
    if (form.isFamilyCompany && !/^\d{1,9}$/.test(form.representativeFileNumber.trim())) {
      ctx.addIssue({
        code: 'custom',
        path: ['representativeFileNumber'],
        message: '1 to 9 digits',
      });
    }
    if (form.isBeneficiaryEnterprise && !isIsoDate(form.beneficiaryNoticeDate)) {
      ctx.addIssue({ code: 'custom', path: ['beneficiaryNoticeDate'], message: 'Pick a date' });
    }
    if (form.isSpecialYear && !isIsoDate(form.specialYearBalanceSheetDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['specialYearBalanceSheetDate'],
        message: 'Pick a date',
      });
    }
    for (const [index, position] of form.reportablePositions.entries()) {
      const value = position.value.trim();
      if (value === '') {
        continue;
      }
      const number = Number(value);
      if (!/^\d+$/.test(value) || number < 1 || number > 999) {
        ctx.addIssue({
          code: 'custom',
          path: ['reportablePositions', index, 'value'],
          message: 'A whole number from 1 to 999',
        });
      }
    }
  });

export type DeclarationsFormState = z.infer<typeof declarationsFormSchema>;

function isIsoDate(value: string): value is TimelessDateString {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

const TRI_STATE_KEYS: readonly TriStateKey[] = [
  ...REQUIRED_DECLARATIONS.map(item => item.key),
  ...OPTIONAL_YES_NO_DECLARATIONS.map(item => item.key),
];
const FLAG_KEYS: readonly FlagDeclarationKey[] = OPTIONAL_FLAG_DECLARATIONS.map(item => item.key);

export function declarationsToForm(
  declarations: DeclarationsValue | null | undefined,
): DeclarationsFormState {
  return {
    answers: Object.fromEntries(
      TRI_STATE_KEYS.map(key => [key, booleanToTriState(declarations?.[key])]),
    ),
    flags: Object.fromEntries(FLAG_KEYS.map(key => [key, declarations?.[key] === true])),
    form6111Obligation: declarations?.form6111Obligation ?? '',
    consolidatedReport: declarations?.consolidatedReport ?? '',
    isFamilyCompany: !!declarations?.familyCompany,
    representativeFileNumber: text(declarations?.familyCompany?.representativeFileNumber),
    isBeneficiaryEnterprise: !!declarations?.beneficiaryEnterprise,
    beneficiaryNoticeDate: text(declarations?.beneficiaryEnterprise?.noticeDate),
    isSpecialYear: !!declarations?.specialYear,
    specialYearBalanceSheetDate: text(declarations?.specialYear?.balanceSheetDate),
    reportablePositions: (declarations?.reportablePositions ?? []).map(position => ({
      value: String(position),
    })),
  };
}

/** The filled-in reportable positions, as numbers (blank rows dropped). */
export function reportablePositionsFromForm(
  positions: DeclarationsFormState['reportablePositions'],
): number[] {
  return positions
    .map(position => position.value.trim())
    .filter(value => value !== '')
    .map(Number);
}

/**
 * The whole `declarations` block to save; `null` (clear) when nothing is answered. A flag that is
 * not marked and an unanswered yes/no are left out; a nested object is sent only while its toggle
 * is on.
 */
export function declarationsFormToInput(
  form: DeclarationsFormState,
): Report1214DeclarationsInput | null {
  const input: Report1214DeclarationsInput = {};
  for (const key of TRI_STATE_KEYS) {
    const value = triStateToBoolean(form.answers[key] ?? '');
    if (value !== null) {
      input[key] = value;
    }
  }
  for (const key of FLAG_KEYS) {
    if (form.flags[key]) {
      input[key] = true;
    }
  }
  if (form.form6111Obligation) {
    input.form6111Obligation = form.form6111Obligation;
  }
  if (form.consolidatedReport) {
    input.consolidatedReport = form.consolidatedReport;
  }
  if (form.isFamilyCompany) {
    input.familyCompany = { representativeFileNumber: form.representativeFileNumber.trim() };
  }
  if (form.isBeneficiaryEnterprise && isIsoDate(form.beneficiaryNoticeDate)) {
    input.beneficiaryEnterprise = {
      noticeDate: form.beneficiaryNoticeDate.trim() as TimelessDateString,
    };
  }
  if (form.isSpecialYear && isIsoDate(form.specialYearBalanceSheetDate)) {
    input.specialYear = {
      balanceSheetDate: form.specialYearBalanceSheetDate.trim() as TimelessDateString,
    };
  }
  const positions = reportablePositionsFromForm(form.reportablePositions);
  if (positions.length > 0) {
    input.reportablePositions = positions;
  }
  return Object.keys(input).length === 0 ? null : input;
}
