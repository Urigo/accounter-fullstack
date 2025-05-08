import { z } from 'zod';

/**
 * Tax Adjustment Record Schema
 * Based on the SHAAM 6111 specification (IncomeTax_software-houses-6111-2023.pdf)
 */

// List of valid codes for Tax Adjustment records (דו"ח התאמה למס)
const validTaxAdjustmentCodes = [
  // 1.17-1.26 in the document
  '100',
  '103',
  '104',
  '110',
  '120',
  '130',
  '135',
  '140',
  '150',
  '160',
  '170',
  '180',
  '181',
  '182',
  '183',
  '184',
  '190',
  '200',
  '300',
  '310',
  '320',
  '330',
  '350',
  '360',
  '370',
  '383',
  '400',
  '430',
  '480',
  '490',
  '500',
  '510',
  '520',
  '530',
  '540',
  '550',
  '570',
  '575',
  '580',
  '585',
  '590',
  '600',
] as const;

// Codes that can have negative values (1.64-1.72 in the document)
const codesAllowingNegativeValues = [
  '100',
  '103',
  '104',
  '135',
  '140',
  '150',
  '160',
  '170',
  '180',
  '300',
  '320',
  '330',
  '350',
  '360',
  '370',
  '383',
  '400',
  '490',
  '500',
  '520',
  '530',
  '540',
  '600',
] as const;

// Tax Adjustment summary codes
const summaryAdjustmentCodes = ['370', '400', '500', '600'] as const;

// Create the Tax Adjustment record schema
const taxAdjustmentRecordSchema = z.object({
  // קוד שדה - Field code
  code: z.enum(validTaxAdjustmentCodes),

  // סכום - Amount
  amount: z
    .number()
    .refine(
      (val, ctx) => {
        // Check if code allows negative values
        const allowsNegative = codesAllowingNegativeValues.includes(
          ctx.path[ctx.path.length - 2] as any,
        );
        return allowsNegative || val >= 0;
      },
      {
        message: 'Negative values are only allowed for specific codes',
      },
    )
    .refine(val => Number.isInteger(val), {
      message: 'Amount must be a whole number (no decimal part)',
    }),
});

// Schema for an array of Tax Adjustment records
const taxAdjustmentRecordsSchema = z
  .array(taxAdjustmentRecordSchema)
  .refine(
    records => {
      // Check for unique code values
      const codes = records.map(record => record.code);
      return new Set(codes).size === codes.length;
    },
    {
      message: 'Each code should appear only once in the records',
    },
  )
  .refine(
    records => {
      // Validate that if '370' exists, it equals sum of specific fields as per rule #5
      const code370Record = records.find(r => r.code === '370');
      if (!code370Record) return true;

      const fieldsToAdd = [
        '110',
        '140',
        '150',
        '170',
        '181',
        '182',
        '184',
        '300',
        '320',
        '330',
        '350',
        '360',
      ];
      const fieldsToSubtract = ['120', '130', '135', '160', '180', '183', '190', '200', '310'];

      const sumToAdd = fieldsToAdd
        .map(code => records.find(r => r.code === code)?.amount || 0)
        .reduce((acc, val) => acc + val, 0);

      const sumToSubtract = fieldsToSubtract
        .map(code => records.find(r => r.code === code)?.amount || 0)
        .reduce((acc, val) => acc + val, 0);

      return code370Record.amount === sumToAdd - sumToSubtract;
    },
    {
      message: 'Field 370 must equal the sum according to calculation rule 5 in the specification',
    },
  )
  .refine(
    records => {
      // Validate rule #6: Field 104 calculation
      const code104Record = records.find(r => r.code === '104');
      const code100Record = records.find(r => r.code === '100');
      const code103Record = records.find(r => r.code === '103');

      if (!code104Record || !code100Record) return true;

      // Get report type for alternative calculations (חלופה)
      const reportType = records.find(r => r.code === 'REPORT_TYPE')?.amount;

      if (reportType === 2) {
        return code104Record.amount === code100Record.amount + (code103Record?.amount || 0);
      }

      return code104Record.amount === code100Record.amount;
    },
    {
      message: 'Field 104 calculation must follow rule 6 in the specification',
    },
  )
  .refine(
    records => {
      // Validate rule #7: Field 400 calculation
      const code400Record = records.find(r => r.code === '400');
      const code100Record = records.find(r => r.code === '100');
      const code103Record = records.find(r => r.code === '103');
      const code370Record = records.find(r => r.code === '370');
      const code383Record = records.find(r => r.code === '383');

      if (!code400Record || !code100Record || !code370Record) return true;

      // Get report type for alternative calculations (חלופה)
      const reportType = records.find(r => r.code === 'REPORT_TYPE')?.amount;

      if (reportType === 1) {
        return code400Record.amount === code100Record.amount + code370Record.amount;
      }
      if (reportType === 2) {
        return (
          code400Record.amount ===
          code100Record.amount + (code103Record?.amount || 0) + code370Record.amount
        );
      }
      if (reportType === 3) {
        return (
          code400Record.amount ===
          code100Record.amount + code370Record.amount + (code383Record?.amount || 0)
        );
      }

      return true;
    },
    {
      message: 'Field 400 calculation must follow rule 7 in the specification',
    },
  )
  .refine(
    records => {
      // Validate rule #8: Field 500 calculation
      const code500Record = records.find(r => r.code === '500');
      const code400Record = records.find(r => r.code === '400');
      const code430Record = records.find(r => r.code === '430');
      const code480Record = records.find(r => r.code === '480');
      const code490Record = records.find(r => r.code === '490');

      if (!code500Record || !code400Record) return true;

      return (
        code500Record.amount ===
        code400Record.amount -
          (code430Record?.amount || 0) -
          (code480Record?.amount || 0) +
          (code490Record?.amount || 0)
      );
    },
    {
      message: 'Field 500 calculation must follow rule 8 in the specification',
    },
  );

// Final schema with proper export
export const TaxAdjustmentSchema = {
  record: taxAdjustmentRecordSchema,
  records: taxAdjustmentRecordsSchema,
  validCodes: validTaxAdjustmentCodes,
  negativeValueCodes: codesAllowingNegativeValues,
  summaryCodes: summaryAdjustmentCodes,
};

export type TaxAdjustmentRecord = z.infer<typeof taxAdjustmentRecordSchema>;
export type TaxAdjustmentRecords = z.infer<typeof taxAdjustmentRecordsSchema>;
