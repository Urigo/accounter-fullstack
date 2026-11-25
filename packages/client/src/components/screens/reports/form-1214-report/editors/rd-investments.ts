import type { Report1214RdInvestmentInput } from '../../../../../gql/graphql.js';
import {
  digitsDescription,
  newRowId,
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
  rowId: string;
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
  return { rowId: newRowId(), companyName: '', companyFileNumber: '', investmentAmount: '' };
}

export function rdInvestmentRowsFromProfile(
  investments: ReadonlyArray<StoredRdInvestment>,
): RdInvestmentRow[] {
  return investments.map(investment => ({
    rowId: newRowId(),
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

/**
 * The whole `rdInvestments` list to save, in row order. An empty list clears the block. Rows past
 * the form's limit are kept: the report validation reports them.
 */
export function rdInvestmentRowsToInput(
  rows: ReadonlyArray<RdInvestmentRow>,
): ParseResult<Report1214RdInvestmentInput[]> {
  const input: Report1214RdInvestmentInput[] = [];
  for (const [index, row] of rows.entries()) {
    const name = `R&D investment ${index + 1}`;
    const companyName = row.companyName.trim();
    if (!companyName) {
      return parseError(`${name}: enter the company name`);
    }
    const companyFileNumber = parseOptionalDigits(row.companyFileNumber, 1, 9);
    if (companyFileNumber === undefined) {
      return parseError(`${name}: the file number is ${digitsDescription(1, 9)}`);
    }
    const investmentAmount = parseOptionalNumber(row.investmentAmount);
    if (investmentAmount == null) {
      return parseError(`${name}: enter the investment amount as a number`);
    }
    input.push({ companyName, companyFileNumber, investmentAmount });
  }
  return parsed(input);
}
