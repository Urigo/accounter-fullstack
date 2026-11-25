import { z } from 'zod';
import type { Report1214RdInvestmentInput } from '../../../../../gql/graphql.js';
import {
  addRowIssues,
  digitsDescription,
  numberToText,
  parsed,
  parseError,
  parseOptionalDigits,
  parseOptionalNumber,
  type ParseResult,
} from './form-values.js';

/** The form has room for 5 R&D investments; the report validation reports more. */
export const RD_INVESTMENTS_FORM_LIMIT = 5;

/** An R&D investment while it is edited: every input as text. */
export type RdInvestmentRow = {
  companyName: string;
  companyFileNumber: string;
  investmentAmount: string;
};

type StoredRdInvestment = {
  companyName: string;
  companyFileNumber?: string | null;
  investmentAmount: number;
};

export function emptyRdInvestmentRow(): RdInvestmentRow {
  return { companyName: '', companyFileNumber: '', investmentAmount: '' };
}

export function rdInvestmentRowsFromProfile(
  investments: ReadonlyArray<StoredRdInvestment>,
): RdInvestmentRow[] {
  return investments.map(investment => ({
    companyName: investment.companyName,
    companyFileNumber: investment.companyFileNumber ?? '',
    investmentAmount: numberToText(investment.investmentAmount),
  }));
}

/**
 * The total the report puts in code 165, as the server computes it: each amount rounded to whole
 * shekels, then summed. Amounts that are not numbers yet are left out.
 */
export function rdInvestmentsTotal(rows: ReadonlyArray<RdInvestmentRow>): number {
  return rows.reduce((total, row) => {
    const amount = parseOptionalNumber(row.investmentAmount);
    return amount == null ? total : total + Math.round(amount);
  }, 0);
}

export type RdInvestmentField = keyof RdInvestmentRow;
export type RdInvestmentRowErrors = Partial<Record<RdInvestmentField, string>>;

/** The format errors of a row, by field; the server checks the rest. Amounts may be negative. */
export function validateRdInvestmentRow(row: RdInvestmentRow): RdInvestmentRowErrors {
  const errors: RdInvestmentRowErrors = {};
  if (!row.companyName.trim()) {
    errors.companyName = 'Enter the company name';
  }
  if (parseOptionalDigits(row.companyFileNumber, 1, 9) === undefined) {
    errors.companyFileNumber = `The file number is ${digitsDescription(1, 9)}`;
  }
  if (parseOptionalNumber(row.investmentAmount) == null) {
    errors.investmentAmount = 'Enter the investment amount as a number';
  }
  return errors;
}

/**
 * The whole `rdInvestments` list to save, in row order. An empty list clears the block. Rows past
 * the form's limit are kept: the report validation reports them.
 */
export function rdInvestmentRowsToInput(
  rows: ReadonlyArray<RdInvestmentRow>,
): ParseResult<Report1214RdInvestmentInput[]> {
  const input: Report1214RdInvestmentInput[] = [];
  for (const [index, row] of rows.entries()) {
    const firstError = Object.values(validateRdInvestmentRow(row))[0];
    const investmentAmount = parseOptionalNumber(row.investmentAmount);
    if (firstError || investmentAmount == null) {
      return parseError(`R&D investment ${index + 1}: ${firstError}`);
    }
    input.push({
      companyName: row.companyName.trim(),
      companyFileNumber: parseOptionalDigits(row.companyFileNumber, 1, 9) ?? null,
      investmentAmount,
    });
  }
  return parsed(input);
}

/** The form state of the R&D investments editor. */
export type RdInvestmentsFormState = { rows: RdInvestmentRow[] };

/** Checks every row with {@link validateRdInvestmentRow}, each error on its field. */
export const rdInvestmentsFormSchema = z
  .object({
    rows: z.array(
      z.object({
        companyName: z.string(),
        companyFileNumber: z.string(),
        investmentAmount: z.string(),
      }),
    ),
  })
  .superRefine((form, ctx) => {
    for (const [index, row] of form.rows.entries()) {
      addRowIssues(ctx, 'rows', index, validateRdInvestmentRow(row));
    }
  });
