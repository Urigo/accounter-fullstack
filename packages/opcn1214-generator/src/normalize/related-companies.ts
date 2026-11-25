/** Normalizer of records 1010, one per related company (SPEC §7.2, §7.4). */
import type { YearLayout } from '../layout/types.js';
import type { RelatedCompany } from '../model/input.js';
import type { NormalizedRecord } from '../model/normalized.js';
import type { ValidateOptions } from '../model/options.js';
import { enumCode, RELATION_TYPE_CODES } from './enums.js';
import { headerValues } from './fields.js';

/**
 * One 1010 record per related company, in input order; serialNumber is the 1-based index and the
 * relation type is written as its code (1..8).
 */
export function normalizeRelatedCompanies(
  companies: readonly RelatedCompany[],
  layout: YearLayout,
  options: ValidateOptions,
): NormalizedRecord[] {
  const def = layout.records['1010'];
  return companies.map((company, index) => ({
    recordType: '1010',
    index,
    ...headerValues(
      def,
      index,
      {
        serialNumber: index + 1,
        companyName: company.companyName,
        companyFileNumber: company.companyFileNumber,
        relationType: enumCode(RELATION_TYPE_CODES, company.relationType),
        assessingOfficeCode: company.assessingOfficeCode,
      },
      options.rounding,
    ),
    codes: new Map(),
    countries: [],
  }));
}
