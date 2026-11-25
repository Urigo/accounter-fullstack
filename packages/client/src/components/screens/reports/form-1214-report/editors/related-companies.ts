import {
  Report1214RelatedCompanyRelationType,
  type Report1214RelatedCompanyInput,
} from '../../../../../gql/graphql.js';
import {
  digitsDescription,
  newRowId,
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
  rowId: string;
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
    rowId: newRowId(),
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
    rowId: newRowId(),
    companyName: company.companyName,
    companyFileNumber: company.companyFileNumber ?? '',
    relationType: company.relationType,
    assessingOfficeCode: numberToText(company.assessingOfficeCode),
  }));
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
    const name = `Related company ${index + 1}`;
    const companyName = row.companyName.trim();
    if (!companyName) {
      return parseError(`${name}: enter the company name`);
    }
    if (!row.relationType) {
      return parseError(`${name}: choose the relation type`);
    }
    const companyFileNumber = parseOptionalDigits(row.companyFileNumber, 1, 9);
    if (companyFileNumber === undefined) {
      return parseError(`${name}: the file number is ${digitsDescription(1, 9)}`);
    }
    const assessingOfficeCode = parseOptionalCount(row.assessingOfficeCode);
    if (assessingOfficeCode === undefined) {
      return parseError(`${name}: the assessing office code is a whole number`);
    }
    input.push({
      companyName,
      companyFileNumber,
      relationType: row.relationType,
      assessingOfficeCode,
    });
  }
  return parsed(input);
}
