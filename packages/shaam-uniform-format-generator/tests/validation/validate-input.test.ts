import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../../src/api/generate-report';
import type { ReportInput } from '../../src/types';
import { ShaamFormatError } from '../../src/validation/errors';
import { validateInput } from '../../src/validation/validate-input';

describe('Input Validation', () => {
  const validInput: ReportInput = {
    business: {
      businessId: 'test123',
      name: 'Test Business',
      taxId: '123456789',
      reportingPeriod: {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      },
    },
    documents: [],
    journalEntries: [],
    accounts: [],
    inventory: [],
  };

  describe('validateInput function', () => {
    it('should return empty array for valid input', () => {
      const errors = validateInput(validInput, 'collect-all');
      expect(errors).toEqual([]);
    });

    it('should not throw for valid input in fail-fast mode', () => {
      expect(() => validateInput(validInput, 'fail-fast')).not.toThrow();
    });

    it('should throw ShaamFormatError in fail-fast mode for invalid input', () => {
      const invalidInput = {
        ...validInput,
        business: {
          ...validInput.business,
          taxId: undefined, // Required field missing
        },
      };

      expect(() => validateInput(invalidInput as unknown as ReportInput, 'fail-fast')).toThrow(
        ShaamFormatError,
      );
    });

    it('should collect all errors in collect-all mode', () => {
      const invalidInput = {
        business: {
          businessId: '', // Empty required field
          // name missing
          taxId: 123, // Wrong type
          reportingPeriod: {
            // startDate missing
            endDate: 'invalid-date',
          },
        },
        documents: 'not-an-array', // Wrong type
      } as unknown as ReportInput;

      const errors = validateInput(invalidInput, 'collect-all');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.every(error => error.recordType === 'input')).toBe(true);
    });

    it('should include field paths in validation errors', () => {
      const invalidInput = {
        ...validInput,
        business: {
          ...validInput.business,
          reportingPeriod: {
            ...validInput.business.reportingPeriod,
            startDate: 123, // Wrong type
          },
        },
      } as unknown as ReportInput;

      const errors = validateInput(invalidInput, 'collect-all');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.field.includes('reportingPeriod.startDate'))).toBe(true);
    });
  });

  describe('generateUniformFormatReport validation integration', () => {
    it('should succeed with valid input', () => {
      expect(() => generateUniformFormatReport(validInput)).not.toThrow();

      const result = generateUniformFormatReport(validInput);
      expect(result).toBeDefined();
      expect(result.iniText).toBeDefined();
      expect(result.dataText).toBeDefined();
    });

    it('should throw in fail-fast mode with invalid input', () => {
      const invalidInput = {
        ...validInput,
        business: undefined,
      } as unknown as ReportInput;

      expect(() => generateUniformFormatReport(invalidInput)).toThrow(ShaamFormatError);
    });

    it('should throw in fail-fast mode by default', () => {
      const invalidInput = {
        ...validInput,
        documents: 'not-an-array',
      } as unknown as ReportInput;

      expect(() => generateUniformFormatReport(invalidInput)).toThrow(ShaamFormatError);
    });

    it('should throw in collect-all mode with validation errors', () => {
      const invalidInput = {
        business: {
          businessId: '',
          name: 123,
          taxId: null,
        },
        documents: 'invalid',
      } as unknown as ReportInput;

      expect(() =>
        generateUniformFormatReport(invalidInput, { validationMode: 'collect-all' }),
      ).toThrow(ShaamFormatError);
    });

    it('should include validation errors in thrown ShaamFormatError', () => {
      const invalidInput = {
        ...validInput,
        business: {
          ...validInput.business,
          businessId: '', // Invalid empty string
        },
      } as unknown as ReportInput;

      try {
        generateUniformFormatReport(invalidInput);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ShaamFormatError);
        const shaamError = error as ShaamFormatError;
        expect(shaamError.errors).toBeDefined();
        expect(shaamError.errors.length).toBeGreaterThan(0);
      }
    });

    it('should respect validationMode option', () => {
      const invalidInput = {
        business: null,
        documents: 'invalid',
      } as unknown as ReportInput;

      // Both modes should throw, but collect-all should gather more errors
      let failFastError: ShaamFormatError | undefined;
      let collectAllError: ShaamFormatError | undefined;

      try {
        generateUniformFormatReport(invalidInput, { validationMode: 'fail-fast' });
      } catch (error) {
        failFastError = error as ShaamFormatError;
      }

      try {
        generateUniformFormatReport(invalidInput, { validationMode: 'collect-all' });
      } catch (error) {
        collectAllError = error as ShaamFormatError;
      }

      expect(failFastError).toBeInstanceOf(ShaamFormatError);
      expect(collectAllError).toBeInstanceOf(ShaamFormatError);

      // collect-all mode should potentially have more errors
      expect(collectAllError!.errors.length).toBeGreaterThanOrEqual(failFastError!.errors.length);
    });
  });

  describe('Error message quality', () => {
    it('should provide meaningful error messages', () => {
      const invalidInput = {
        ...validInput,
        business: {
          ...validInput.business,
          taxId: 123, // Should be string
        },
      } as unknown as ReportInput;

      try {
        validateInput(invalidInput, 'fail-fast');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ShaamFormatError);
        const shaamError = error as ShaamFormatError;
        expect(shaamError.message).toContain('Validation failed');
        expect(shaamError.errors[0]?.message).toContain('string');
      }
    });

    it('should include field paths in error details', () => {
      const invalidInput = {
        ...validInput,
        business: {
          ...validInput.business,
          reportingPeriod: {
            startDate: '2024-01-01',
            endDate: 123, // Wrong type
          },
        },
      } as unknown as ReportInput;

      const errors = validateInput(invalidInput, 'collect-all');
      expect(errors.length).toBeGreaterThan(0);

      const endDateError = errors.find(error => error.field.includes('endDate'));
      expect(endDateError).toBeDefined();
      expect(endDateError!.field).toBe('business.reportingPeriod.endDate');
    });
  });
});
