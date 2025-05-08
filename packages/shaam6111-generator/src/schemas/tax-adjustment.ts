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
  return `${TAX_ADJUSTMENT_CODE_NAMES[code]} (${code})`;
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
  //   104:
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
  //   400:
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
  .superRefine((records, ctx) => {
    // Check for unique code values & create a map for faster lookups
    const codeToAmountMap = new Map<AllowedTaxAdjustmentCode, number>();
    records.map((record, i) => {
      const code = record.code as AllowedTaxAdjustmentCode;
      if (codeToAmountMap.has(code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate code: ${codeToName(code)}`,
          path: [i, 'code'],
        });
      } else {
        codeToAmountMap.set(code, record.amount);
      }
    });

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
    const codeMap = new Map<AllowedTaxAdjustmentCode, number>();
    records.map((record, index) => {
      if (codeMap.has(record.code as AllowedTaxAdjustmentCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate code ${record.code} found`,
          path: [index, 'code'],
        });
      } else {
        codeMap.set(record.code as AllowedTaxAdjustmentCode, index);
      }
    });

    // // Validate rule #6: Field 104 calculation
    // const code104Index = codeMap.get('104');
    // const code100Index = codeMap.get('100');
    // const code103Index = codeMap.get('103');

    // if (code104Index !== undefined && code100Index !== undefined) {
    //   const code104Record = records[code104Index];
    //   const code100Record = records[code100Index];
    //   const code103Record = code103Index !== undefined ? records[code103Index] : undefined;

    //   // Get report type for alternative calculations (חלופה)
    //   // This would normally come from your header schema
    //   const reportType = 1; // Default to 1 if not provided elsewhere

    //   let expectedValue: number;

    //   if (reportType === 2 && code103Record) {
    //     expectedValue = code100Record.amount + code103Record.amount;
    //   } else {
    //     expectedValue = code100Record.amount;
    //   }

    //   if (code104Record.amount !== expectedValue) {
    //     ctx.addIssue({
    //       code: z.ZodIssueCode.custom,
    //       message: `Field 104 must equal ${expectedValue} according to calculation rule 6 in the specification`,
    //       path: [code104Index, 'amount'],
    //     });
    //   }
    // }

    // // Validate rule #7: Field 400 calculation
    // const code400Index = codeMap.get('400');
    // const code370Index2 = codeMap.get('370');
    // const code383Index = codeMap.get('383');

    // if (code400Index !== undefined && code100Index !== undefined && code370Index2 !== undefined) {
    //   const code400Record = records[code400Index];
    //   const code100Record = records[code100Index];
    //   const code370Record = records[code370Index2];
    //   const code103Record = code103Index !== undefined ? records[code103Index] : undefined;
    //   const code383Record = code383Index !== undefined ? records[code383Index] : undefined;

    //   // Get report type for alternative calculations (חלופה)
    //   // This would normally come from your header schema
    //   const reportType = 1; // Default to 1 if not provided elsewhere

    //   let expectedValue: number;

    //   if (reportType === 1) {
    //     expectedValue = code100Record.amount + code370Record.amount;
    //   } else if (reportType === 2 && code103Record) {
    //     expectedValue = code100Record.amount + code103Record.amount + code370Record.amount;
    //   } else if (reportType === 3 && code383Record) {
    //     expectedValue = code100Record.amount + code370Record.amount + code383Record.amount;
    //   } else {
    //     expectedValue = code100Record.amount + code370Record.amount;
    //   }

    //   if (code400Record.amount !== expectedValue) {
    //     ctx.addIssue({
    //       code: z.ZodIssueCode.custom,
    //       message: `Field 400 must equal ${expectedValue} according to calculation rule 7 in the specification`,
    //       path: [code400Index, 'amount'],
    //     });
    //   }
    // }
  });
