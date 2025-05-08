import { z } from 'zod';
import {
  allowedCodesSet,
  AllowedProfitLossCode,
  codeNames,
  CommonSummaryCode,
  negativeAllowedCodesSet,
  SECTION_1_1,
  SECTION_1_4,
  SECTION_1_9,
  SECTION_1_10,
  SECTION_1_11,
  SECTION_1_12,
  SECTION_1_14,
  SECTION_1_15,
  SECTION_1_16,
  SummaryCode,
} from '../types/profit-and-loss.js';

/**
 * Schema for validating profit and loss records in SHAAM6111 reports
 * Based on the Israeli Tax Authority specification
 */

function codeToName(code: AllowedProfitLossCode): string {
  return `${codeNames[code]} (${code})`;
}

// Schema for a single profit and loss record
const profitLossRecordSchema = z
  .object({
    // Code field - must be one of the allowed codes
    code: z
      .number()
      .int()
      .refine(code => allowedCodesSet.has(code as AllowedProfitLossCode), {
        message: 'Invalid code for profit and loss section',
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

function commonCumulativeCodeValidation(
  code: CommonSummaryCode,
  sectionCodes: readonly AllowedProfitLossCode[],
) {
  return {
    formula: (map: Map<number, number>) => {
      return sectionCodes
        .filter(sectionCode => sectionCode !== code)
        .map(sectionCode => map.get(sectionCode) || 0)
        .reduce((a, b) => a + b, 0);
    },
    description: 'Sum of all subsections',
  };
}

// Define the validation logic for each summary code
const summaryValidations: Record<
  SummaryCode,
  { formula: (map: Map<number, number>) => number; description: string }
> = {
  1000: commonCumulativeCodeValidation(1000, SECTION_1_1),
  1300: {
    formula: (map: Map<number, number>) => {
      return (
        [1306, 1308, 1307, 1310, 1320, 1330, 1340, 1350, 1360, 1371, 1372, 1390, 1400]
          .map(code => map.get(code) || 0)
          .reduce((a, b) => a + b, 0) - (map.get(1450) || 0)
      );
    },
    description: '1306+1308+1307+1310+1320+1330+1340+1350+1360+1371+1372+1390+1400-1450',
  },
  2000: {
    formula: (map: Map<number, number>) => {
      return (
        [
          2005, 2006, 2011, 2012, 2015, 2020, 2025, 2030, 2035, 2040, 2045, 2050, 2060, 2066, 2067,
          2070, 2075, 2080, 2085, 2090,
        ]
          .map(code => map.get(code) || 0)
          .reduce((a, b) => a + b, 0) -
        (map.get(2068) || 0) -
        (map.get(2095) || 0)
      );
    },
    description:
      '2005+2006+2011+2012+2015+2020+2025+2030+2035+2040+2045+2050+2060+2066+2067-2068+2070+2075+2080+2085+2090-2095',
  },
  2500: commonCumulativeCodeValidation(2500, SECTION_1_4),
  3000: {
    formula: (map: Map<number, number>) => {
      return (
        [
          3011, 3013, 3012, 3015, 3020, 3025, 3030, 3040, 3045, 3050, 3060, 3066, 3067, 3070, 3075,
          3080, 3085, 3090, 3100, 3120, 3190,
        ]
          .map(code => map.get(code) || 0)
          .reduce((a, b) => a + b, 0) - (map.get(3068) || 0)
      );
    },
    description:
      '3011+3013+3012+3015+3020+3025+3030+3040+3045+3050+3060+3066+3067-3068+3070+3075+3080+3085+3090+3100+3120+3190',
  },
  3500: {
    formula: (map: Map<number, number>) => {
      return (
        [
          3511, 3513, 3512, 3515, 3520, 3530, 3535, 3540, 3545, 3550, 3560, 3566, 3567, 3570, 3575,
          3580, 3590, 3595, 3600, 3610, 3620, 3625, 3631, 3632, 3640, 3650, 3660, 3665, 3680, 3685,
          3690,
        ]
          .map(code => map.get(code) || 0)
          .reduce((a, b) => a + b, 0) - (map.get(3568) || 0)
      );
    },
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
    formula: (map: Map<number, number>) => {
      return (
        (map.get(1000) || 0) -
        (map.get(1300) || 0) -
        (map.get(2000) || 0) -
        (map.get(2500) || 0) -
        (map.get(3000) || 0) -
        (map.get(3500) || 0) +
        (map.get(5000) || 0) +
        (map.get(5100) || 0) +
        (map.get(5200) || 0) -
        (map.get(5300) || 0)
      );
    },
    description: '1000-1300-2000-2500-3000-3500+5000+5100+5200-5300',
  },
};

// Schema for an array of profit and loss records
export const profitLossArraySchema = z.array(profitLossRecordSchema).superRefine((records, ctx) => {
  // Check for duplicate codes
  const seenCodes = new Set<number>();
  for (let i = 0; i < records.length; i++) {
    const code = records[i].code as AllowedProfitLossCode;
    if (seenCodes.has(code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate code: ${codeToName(code)}`,
        path: [i, 'code'],
      });
    }
    seenCodes.add(code);
  }

  // Create a map for faster lookups
  const codeToAmountMap = new Map(records.map(r => [r.code, r.amount]));

  // Validate each summary field with its formula
  Object.entries(summaryValidations).map(([codeStr, validation]) => {
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
  });
});
