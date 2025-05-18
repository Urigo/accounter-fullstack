import { z } from 'zod';
import {
  ALLOWED_TAX_ADJUSTMENT_CODES,
  AllowedTaxAdjustmentCode,
  NEGATIVE_ALLOWED_TAX_ADJUSTMENTS_CODES,
  TAX_ADJUSTMENT_CODE_NAMES,
  TaxAdjustmentSummaryCode,
} from '../types/index.js';

/**
 * Tax Adjustment Record Schema
 * Based on the SHAAM 6111 specification (IncomeTax_software-houses-6111-2023.pdf)
 */

// Create a set for faster lookup of allowed codes
export const allowedCodesSet = new Set(ALLOWED_TAX_ADJUSTMENT_CODES);
export const negativeAllowedCodesSet = new Set<number>(NEGATIVE_ALLOWED_TAX_ADJUSTMENTS_CODES);

function codeToName(code: AllowedTaxAdjustmentCode): string {
  return `${TAX_ADJUSTMENT_CODE_NAMES[code] ?? 'Unknown code'} (${code})`;
}

// Create the Tax Adjustment record schema
const taxAdjustmentRecordSchema = z
  .object({
    // קוד שדה - Field code
    code: z
      .number()
      .int()
      .refine(code => allowedCodesSet.has(code as AllowedTaxAdjustmentCode), {
        message: 'Invalid code for tax adjustment section',
      }),

    // סכום - Amount
    amount: z.number().int(),
  })
  .superRefine((record, ctx) => {
    // Validate that non-negative codes don't have negative amounts
    if (!negativeAllowedCodesSet.has(record.code) && record.amount < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Code ${codeToName(record.code as AllowedTaxAdjustmentCode)} does not allow negative amounts`,
        path: ['amount'],
      });
    }
  });

// Define the validation logic for each summary code
const summaryValidations: Partial<
  Record<
    TaxAdjustmentSummaryCode,
    { formula: (map: Map<number, number>) => number; description: string }
  >
> = {
  //   100:
  //   103:
  //   104: validated on the report level
  370: {
    formula: (map: Map<number, number>) => {
      return (
        [110, 140, 150, 170, 181, 182, 184, 300, 320, 330, 350, 360]
          .map(code => map.get(code) || 0)
          .reduce((a, b) => a + b, 0) -
        [120, 130, 135, 160, 180, 183, 190, 200, 310]
          .map(code => map.get(code) || 0)
          .reduce((a, b) => a + b, 0)
      );
    },
    description:
      '110+140+150+170+181+182+184+300+320+330+350+360-120-130-135-160-180-183-190-200-310',
  },
  //   383:
  //   400: validated on the report level
  500: {
    formula: (map: Map<number, number>) => {
      return (map.get(400) || 0) - (map.get(430) || 0) - (map.get(480) || 0) + (map.get(490) || 0);
    },
    description: '400-430-480+490',
  },
  //   600:
};

// Schema for an array of Tax Adjustment records
export const taxAdjustmentArraySchema = z
  .array(taxAdjustmentRecordSchema)
  .max(150)
  .superRefine((records, ctx) => {
    // Check for unique code values & create a map for faster lookups
    const codeToAmountMap = checkForUniqueCodes(records, ctx);

    // Validate each summary field with its formula
    Object.entries(summaryValidations).map(([codeStr, validation]) => {
      const code = parseInt(codeStr) as AllowedTaxAdjustmentCode;
      if (codeToAmountMap.has(code)) {
        const actualAmount = codeToAmountMap.get(code);
        const expectedAmount = validation.formula(codeToAmountMap);

        if (actualAmount !== expectedAmount) {
          const index = records.findIndex(r => r.code === code);
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Value for code ${codeToName(code)} should equal the sum: ${validation.description}`,
            path: [index, 'amount'],
          });
        }
      }
    });

    // Check for unique code values
    checkForUniqueCodes(records, ctx);
  });

function checkForUniqueCodes(
  records: {
    code: number;
    amount: number;
  }[],
  ctx: z.RefinementCtx,
) {
  const codeMap = new Map<AllowedTaxAdjustmentCode, number>();
  records.map((record, index) => {
    if (codeMap.has(record.code as AllowedTaxAdjustmentCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate code ${codeToName(record.code as AllowedTaxAdjustmentCode)} found`,
        path: [index, 'code'],
      });
    }
    codeMap.set(record.code as AllowedTaxAdjustmentCode, record.amount);
  });

  return codeMap;
}
