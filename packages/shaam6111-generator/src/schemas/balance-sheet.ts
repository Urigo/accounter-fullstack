import { z } from 'zod';
import {
  ALLOWED_BALANCE_SHEET_CODES,
  AllowedBalanceSheetCode,
  BALANCE_SHEET_CODE_NAMES,
  BalanceSheetSummaryCode,
  CommonBalanceSheetSummaryCode,
  NEGATIVE_ALLOWED_BALANCE_SHEET_CODES,
  NegativeAllowedBalanceSheetCode,
  SECTION_1_21,
  SECTION_1_27,
  SECTION_1_28,
  SECTION_1_30,
  SECTION_1_32,
  SECTION_1_33,
  SECTION_1_36,
  SECTION_1_37,
  SECTION_1_38,
  SECTION_1_39,
  SECTION_1_40,
  SECTION_1_41,
  SECTION_1_43,
  SECTION_1_44,
  SECTION_1_45,
  SECTION_1_46,
  SECTION_1_48,
  SECTION_1_50,
  SECTION_1_51,
} from '../types/index.js';

// Create a set for faster lookup of allowed codes
const allowedCodesSet = new Set<AllowedBalanceSheetCode>(ALLOWED_BALANCE_SHEET_CODES);
const negativeAllowedCodesSet = new Set<NegativeAllowedBalanceSheetCode>(
  NEGATIVE_ALLOWED_BALANCE_SHEET_CODES,
);

function codeToName(code: AllowedBalanceSheetCode): string {
  return `${BALANCE_SHEET_CODE_NAMES[code] ?? 'Unknown code'} (${code})`;
}

// Zod schema for a single balance sheet record
const balanceSheetRecordSchema = z
  .object({
    code: z
      .number()
      .int()
      .superRefine((value, ctx) => {
        if (!allowedCodesSet.has(value as AllowedBalanceSheetCode)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid balance sheet code: ${value}`,
            path: ['code'],
          });
        }
      }),
    amount: z.number().int(),
  })
  .superRefine((record, ctx) => {
    // Validate that non-negative codes don't have negative amounts
    if (
      !negativeAllowedCodesSet.has(record.code as NegativeAllowedBalanceSheetCode) &&
      record.amount < 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Code ${codeToName(record.code as AllowedBalanceSheetCode)} does not allow negative amounts`,
        path: ['amount'],
      });
    }
  });

function commonCumulativeCodeValidation(
  code: CommonBalanceSheetSummaryCode,
  sectionCodes: readonly AllowedBalanceSheetCode[],
) {
  return {
    formula: (map: Map<AllowedBalanceSheetCode, number>) => {
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
  BalanceSheetSummaryCode,
  { formula: (map: Map<AllowedBalanceSheetCode, number>) => number; description: string }
> = {
  7000: commonCumulativeCodeValidation(7000, [7100, 7200, 7300, 7400, 7600, 7700, 7800]),
  7100: commonCumulativeCodeValidation(7100, SECTION_1_27),
  7200: commonCumulativeCodeValidation(7200, SECTION_1_28),
  7300: {
    formula: (map: Map<AllowedBalanceSheetCode, number>) => {
      return (
        ([7310, 7320, 7330, 7350, 7360, 7390] as AllowedBalanceSheetCode[])
          .map(code => map.get(code) || 0)
          .reduce((a, b) => a + b, 0) - (map.get(7380) || 0)
      );
    },
    description: '7310+7320+7330+7350+7360-7380+7390',
  },
  7400: commonCumulativeCodeValidation(7400, SECTION_1_30),
  7600: commonCumulativeCodeValidation(7600, SECTION_1_21),
  7700: commonCumulativeCodeValidation(7700, SECTION_1_32),
  7800: commonCumulativeCodeValidation(7800, SECTION_1_33),
  8000: {
    formula: (map: Map<AllowedBalanceSheetCode, number>) => {
      return (
        (
          [
            8010, 8020, 8025, 8030, 8040, 8050, 8060, 8080, 8090, 8095, 8100, 8105, 8170,
          ] as AllowedBalanceSheetCode[]
        )
          .map(code => map.get(code) || 0)
          .reduce((a, b) => a + b, 0) -
        ([8110, 8120, 8130, 8140, 8150, 8160, 8180, 8190] as AllowedBalanceSheetCode[])
          .map(code => map.get(code) || 0)
          .reduce((a, b) => a + b, 0)
      );
    },
    description:
      '8010+8020+8025+8030+8040+8050+8060+8080+8090+8095+8100+8105-8110-8120-8130-8140-8150-8160+8170-8180-8190',
  },
  8200: commonCumulativeCodeValidation(8200, SECTION_1_37),
  8300: commonCumulativeCodeValidation(8300, SECTION_1_38),
  8400: commonCumulativeCodeValidation(8400, SECTION_1_39),
  8500: commonCumulativeCodeValidation(8500, SECTION_1_40),
  8600: commonCumulativeCodeValidation(8600, SECTION_1_41),
  8700: commonCumulativeCodeValidation(8700, SECTION_1_36),
  8888: {
    formula: (map: Map<AllowedBalanceSheetCode, number>) => {
      return ([7000, 8000, 8700, 8200, 8300, 8400, 8500, 8600] as AllowedBalanceSheetCode[])
        .map(code => map.get(code) || 0)
        .reduce((a, b) => a + b, 0);
    },
    description: '7000+8000+8700+8200+8300+8400+8500+8600',
  },
  9000: {
    formula: (map: Map<AllowedBalanceSheetCode, number>) => {
      return ([9100, 9200, 9400, 9500] as AllowedBalanceSheetCode[])
        .map(code => map.get(code) || 0)
        .reduce((a, b) => a + b, 0);
    },
    description: '9100+9200+9400+9500',
  },
  9100: commonCumulativeCodeValidation(9100, SECTION_1_43),
  9200: commonCumulativeCodeValidation(9200, SECTION_1_44),
  9400: commonCumulativeCodeValidation(9400, SECTION_1_45),
  9500: commonCumulativeCodeValidation(9500, SECTION_1_46),
  9600: commonCumulativeCodeValidation(9600, SECTION_1_48),
  9700: {
    formula: (map: Map<AllowedBalanceSheetCode, number>) => {
      return (map.get(9710) || 0) - (map.get(9720) || 0) + (map.get(9790) || 0);
    },
    description: '9710-9720+9790',
  },
  9800: commonCumulativeCodeValidation(9800, SECTION_1_50),
  9900: commonCumulativeCodeValidation(9900, SECTION_1_51),
  9999: {
    formula: (map: Map<AllowedBalanceSheetCode, number>) => {
      return ([9000, 9600, 9700, 9800, 9900] as AllowedBalanceSheetCode[])
        .map(code => map.get(code) || 0)
        .reduce((a, b) => a + b, 0);
    },
    description: '9000+9600+9700+9800+9900',
  },
};

// Zod schema for the array of balance sheet records
export const balanceSheetArraySchema = z
  .array(balanceSheetRecordSchema)
  .max(150)
  .superRefine((records, ctx) => {
    // Check for unique code values & create a map for faster lookups
    const codeToAmountMap = new Map<AllowedBalanceSheetCode, number>();
    records.map((record, i) => {
      const code = record.code as AllowedBalanceSheetCode;
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
      const code = parseInt(codeStr) as AllowedBalanceSheetCode;
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

    // Check total assets equals total liabilities + equity
    const totalAssets = codeToAmountMap.get(8888);
    const totalLiabilitiesEquity = codeToAmountMap.get(9999);

    if (totalAssets !== totalLiabilitiesEquity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Total assets (8888) must equal total liabilities + equity (9999). Got: ${totalAssets} vs ${totalLiabilitiesEquity}`,
      });
    }

    // Check if all required summary codes are present
    const requiredSummaryCodes = [7000, 8888, 9000, 9999];
    for (const code of requiredSummaryCodes) {
      if (!codeToAmountMap.has(code as AllowedBalanceSheetCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing required summary code: ${code}`,
        });
      }
    }
  });

// Type for the balance sheet records
export type BalanceSheetRecord = z.infer<typeof balanceSheetRecordSchema>;
