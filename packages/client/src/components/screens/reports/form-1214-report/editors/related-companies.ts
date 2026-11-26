import { z } from 'zod';
import {
  Report1214RelatedCompanyRelationType,
  type Report1214RelatedCompanyInput,
} from '../../../../../gql/graphql.js';
import {
  addRowIssues,
  digitsDescription,
  numberToText,
  parsed,
  parseError,
  parseOptionalCount,
  parseOptionalDigits,
  type ParseResult,
} from './form-values.js';

/** The form has room for 3 related companies; the report validation reports more. */
export const RELATED_COMPANIES_FORM_LIMIT = 3;

/** Readable names of the record 1010 relation types, in the form's order. */
export const RELATION_TYPE_LABELS: Record<Report1214RelatedCompanyRelationType, string> = {
  [Report1214RelatedCompanyRelationType.Parent]: 'Parent company',
  [Report1214RelatedCompanyRelationType.Subsidiary]: 'Subsidiary',
  [Report1214RelatedCompanyRelationType.Partnership]: 'Partnership',
  [Report1214RelatedCompanyRelationType.KibbutzRelatedCorporation]: 'Kibbutz-related corporation',
  [Report1214RelatedCompanyRelationType.JointlyControlled]: 'Jointly controlled',
  [Report1214RelatedCompanyRelationType.Granddaughter]: 'Granddaughter company',
  [Report1214RelatedCompanyRelationType.Grandmother]: 'Grandmother company',
  [Report1214RelatedCompanyRelationType.Other]: 'Other',
};

export const RELATION_TYPES = Object.keys(
  RELATION_TYPE_LABELS,
) as Report1214RelatedCompanyRelationType[];

export function relationTypeLabel(relationType: Report1214RelatedCompanyRelationType): string {
  return RELATION_TYPE_LABELS[relationType] ?? relationType;
}

/** A related company while it is edited: every input as text. */
export type RelatedCompanyRow = {
  companyName: string;
  companyFileNumber: string;
  relationType: Report1214RelatedCompanyRelationType | '';
  assessingOfficeCode: string;
};

type StoredRelatedCompany = {
  companyName: string;
  companyFileNumber?: string | null;
  relationType: Report1214RelatedCompanyRelationType;
  assessingOfficeCode?: number | null;
};

export function emptyRelatedCompanyRow(): RelatedCompanyRow {
  return {
    companyName: '',
    companyFileNumber: '',
    relationType: '',
    assessingOfficeCode: '',
  };
}

export function relatedCompanyRowsFromProfile(
  companies: ReadonlyArray<StoredRelatedCompany>,
): RelatedCompanyRow[] {
  return companies.map(company => ({
    companyName: company.companyName,
    companyFileNumber: company.companyFileNumber ?? '',
    relationType: company.relationType,
    assessingOfficeCode: numberToText(company.assessingOfficeCode),
  }));
}

export type RelatedCompanyField = keyof RelatedCompanyRow;
export type RelatedCompanyRowErrors = Partial<Record<RelatedCompanyField, string>>;

/** The format errors of a row, by field; the server checks the rest. */
export function validateRelatedCompanyRow(row: RelatedCompanyRow): RelatedCompanyRowErrors {
  const errors: RelatedCompanyRowErrors = {};
  if (!row.companyName.trim()) {
    errors.companyName = 'Enter the company name';
  }
  if (!row.relationType) {
    errors.relationType = 'Choose the relation type';
  }
  if (parseOptionalDigits(row.companyFileNumber, 1, 9) === undefined) {
    errors.companyFileNumber = `The file number is ${digitsDescription(1, 9)}`;
  }
  if (parseOptionalCount(row.assessingOfficeCode) === undefined) {
    errors.assessingOfficeCode = 'The assessing office code is a whole number, 0 or more';
  }
  return errors;
}

/**
 * The whole `relatedCompanies` list to save, in row order. An empty list clears the block. Rows
 * past the form's limit are kept: the report validation reports them.
 */
export function relatedCompanyRowsToInput(
  rows: ReadonlyArray<RelatedCompanyRow>,
): ParseResult<Report1214RelatedCompanyInput[]> {
  const input: Report1214RelatedCompanyInput[] = [];
  for (const [index, row] of rows.entries()) {
    const firstError = Object.values(validateRelatedCompanyRow(row))[0];
    if (firstError || !row.relationType) {
      return parseError(`Related company ${index + 1}: ${firstError}`);
    }
    input.push({
      companyName: row.companyName.trim(),
      companyFileNumber: parseOptionalDigits(row.companyFileNumber, 1, 9) ?? null,
      relationType: row.relationType,
      assessingOfficeCode: parseOptionalCount(row.assessingOfficeCode) ?? null,
    });
  }
  return parsed(input);
}

/** The form state of the related-companies editor. */
export type RelatedCompaniesFormState = { rows: RelatedCompanyRow[] };

/** Checks every row with {@link validateRelatedCompanyRow}, each error on its field. */
export const relatedCompaniesFormSchema = z
  .object({
    rows: z.array(
      z.object({
        companyName: z.string(),
        companyFileNumber: z.string(),
        relationType: z.union([z.enum(Report1214RelatedCompanyRelationType), z.literal('')]),
        assessingOfficeCode: z.string(),
      }),
    ),
  })
  .superRefine((form, ctx) => {
    for (const [index, row] of form.rows.entries()) {
      addRowIssues(ctx, 'rows', index, validateRelatedCompanyRow(row));
    }
  });
