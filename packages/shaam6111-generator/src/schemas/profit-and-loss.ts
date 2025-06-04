import { z } from 'zod';
import {
  ALLOWED_PROFIT_LOSS_CODES,
  AllowedProfitLossCode,
  CommonProfitLossSummaryCode,
  NEGATIVE_ALLOWED_PROFIT_LOSS_CODES,
  PROFIT_LOSS_CODE_NAMES,
  ProfitLossSummaryCode,
  SECTION_1_1,
  SECTION_1_4,
  SECTION_1_9,
  SECTION_1_10,
  SECTION_1_11,
  SECTION_1_12,
  SECTION_1_14,
  SECTION_1_15,
  SECTION_1_16,
} from '../types/index.js';

/**
 * Schema for validating profit and loss records in SHAAM6111 reports
 * Based on the Israeli Tax Authority specification
 */

// Create a set for faster lookup of allowed codes
const allowedCodesSet = new Set(ALLOWED_PROFIT_LOSS_CODES);
const negativeAllowedCodesSet = new Set<number>(NEGATIVE_ALLOWED_PROFIT_LOSS_CODES);

function codeToName(code: AllowedProfitLossCode): string {
  return `${PROFIT_LOSS_CODE_NAMES[code] ?? 'Unknown code'} (${code})`;
}

// Schema for a single profit and loss record
const profitLossRecordSchema = z
  .object({
    // Code field - must be one of the allowed codes
    code: z
      .number()
      .int()
      .refine(code => allowedCodesSet.has(code as AllowedProfitLossCode), {
        message: 'Invalid profit and loss code',
      }),

    // Amount field - must be a valid integer
    amount: z.number().int(),
  })
  .superRefine((record, ctx) => {
    // Validate that non-negative codes don't have negative amounts
    if (!negativeAllowedCodesSet.has(record.code) && record.amount < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Code ${codeToName(record.code as AllowedProfitLossCode)} does not allow negative amounts`,
        path: ['amount'],
      });
    }
  });

function cumulativeCodeValidationFormula(
  code: ProfitLossSummaryCode,
  sectionCodes: readonly AllowedProfitLossCode[],
  subtractSectionCodes?: readonly AllowedProfitLossCode[],
) {
  return (map: Map<AllowedProfitLossCode, number>) => {
    const sectionAmount = sectionCodes
      .filter(sectionCode => sectionCode !== code)
      .map(sectionCode => map.get(sectionCode) || 0)
      .reduce((a, b) => a + b, 0);
    const subtractAmount = subtractSectionCodes
      ? subtractSectionCodes
          .filter(sectionCode => sectionCode !== code)
          .map(sectionCode => map.get(sectionCode) || 0)
          .reduce((a, b) => a + b, 0)
      : 0;
    return sectionAmount - subtractAmount;
  };
}

function commonCumulativeCodeValidation(
  code: CommonProfitLossSummaryCode,
  sectionCodes: readonly AllowedProfitLossCode[],
  subtractSectionCodes?: readonly AllowedProfitLossCode[],
) {
  return {
    formula: cumulativeCodeValidationFormula(code, sectionCodes, subtractSectionCodes),
    description: 'Sum of all subsections',
  };
}

// Define arrays for validation formulas
const INCOME_COST_CODES = [
  1306, 1308, 1307, 1310, 1320, 1330, 1340, 1350, 1360, 1371, 1372, 1390, 1400,
] as const;

// Define the validation logic for each summary code
const summaryValidations: Record<
  ProfitLossSummaryCode,
  { formula: (map: Map<AllowedProfitLossCode, number>) => number; description: string }
> = {
  1000: commonCumulativeCodeValidation(1000, SECTION_1_1),
  1300: {
    formula: cumulativeCodeValidationFormula(1300, INCOME_COST_CODES, [1450]),
    description: `${INCOME_COST_CODES.join('+')}-1450`,
  },
  2000: {
    formula: cumulativeCodeValidationFormula(
      2000,
      [
        2005, 2006, 2011, 2012, 2015, 2020, 2025, 2030, 2035, 2040, 2045, 2050, 2060, 2066, 2067,
        2070, 2075, 2080, 2085, 2090,
      ],
      [2068, 2095],
    ),
    description:
      '2005+2006+2011+2012+2015+2020+2025+2030+2035+2040+2045+2050+2060+2066+2067-2068+2070+2075+2080+2085+2090-2095',
  },
  2500: commonCumulativeCodeValidation(2500, SECTION_1_4),
  3000: {
    formula: cumulativeCodeValidationFormula(
      3000,
      [
        3011, 3013, 3012, 3015, 3020, 3025, 3030, 3040, 3045, 3050, 3060, 3066, 3067, 3070, 3075,
        3080, 3085, 3090, 3100, 3120, 3190,
      ],
      [3068],
    ),
    description:
      '3011+3013+3012+3015+3020+3025+3030+3040+3045+3050+3060+3066+3067-3068+3070+3075+3080+3085+3090+3100+3120+3190',
  },
  3500: {
    formula: cumulativeCodeValidationFormula(
      3500,
      [
        3511, 3513, 3512, 3515, 3520, 3530, 3535, 3540, 3545, 3550, 3560, 3566, 3567, 3570, 3575,
        3580, 3590, 3595, 3600, 3610, 3620, 3625, 3631, 3632, 3640, 3650, 3660, 3665, 3680, 3685,
        3690,
      ],
      [3568],
    ),
    description:
      '3511+3513+3512+3515+3520+3530+3535+3540+3545+3550+3560+3566+3567-3568+3570+3575+3580+3590+3595+3600+3610+3620+3625+3631+3632+3640+3650+3660+3665+3680+3685+3690',
  },
  5000: commonCumulativeCodeValidation(5000, SECTION_1_9),
  5100: commonCumulativeCodeValidation(5100, SECTION_1_10),
  5200: commonCumulativeCodeValidation(5200, SECTION_1_11),
  5300: commonCumulativeCodeValidation(5300, SECTION_1_12),
  5600: commonCumulativeCodeValidation(5600, SECTION_1_14),
  5700: commonCumulativeCodeValidation(5700, SECTION_1_15),
  5800: commonCumulativeCodeValidation(5800, SECTION_1_16),
  6666: {
    formula: cumulativeCodeValidationFormula(
      6666,
      [1000, 5000, 5100, 5200],
      [1300, 2000, 2500, 3000, 3500, 5300],
    ),
    description: '1000-1300-2000-2500-3000-3500+5000+5100+5200-5300',
  },
};

// Schema for an array of profit and loss records
export const profitLossArraySchema = z
  .array(profitLossRecordSchema)
  .max(150)
  .superRefine((records, ctx) => {
    // Check for unique code values & create a map for faster lookups
    const codeToAmountMap = new Map<AllowedProfitLossCode, number>();
    records.map((record, i) => {
      const code = record.code as AllowedProfitLossCode;
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
    for (const [codeStr, validation] of Object.entries(summaryValidations)) {
      const code = parseInt(codeStr) as AllowedProfitLossCode;
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
    }
  });
