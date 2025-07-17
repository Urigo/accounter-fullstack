import { describe, expect, it } from 'vitest';
import {
  AccountingTypeEnum,
  AccountingTypeLabels,
  BalanceRequiredEnum,
  BranchInfoFlagEnum,
  CharacterEncodingEnum,
  CountryCodeEnum,
  CountryLabels,
  CurrencyCodeEnum,
  CurrencyLabels,
  DebitCreditIndicatorEnum,
  DebitCreditIndicatorLabels,
  // Enums
  DocumentTypeEnum,
  // Labels
  DocumentTypeLabels,
  DocumentTypeLabelsEn,
  LanguageCodeEnum,
  PaymentMethodEnum,
  PaymentMethodLabels,
  RecordTypeEnum,
  // Constants and utilities
  SHAAM_CONSTANTS,
  ShaamEnumSchemas,
  ShaamLabels,
  SoftwareTypeEnum,
  SoftwareTypeLabels,
  TrialBalanceCodeEnum,
  TrialBalanceCodeLabels,
  type AccountingType,
  type CountryCode,
  type CurrencyCode,
  type DebitCreditIndicator,
  // Types
  type DocumentType,
  type PaymentMethod,
  type RecordType,
  type SoftwareType,
  type TrialBalanceCode,
} from '../../src/types/enums';

describe('SHAAM Format Enums', () => {
  describe('DocumentTypeEnum', () => {
    it('should validate correct document types', () => {
      expect(DocumentTypeEnum.parse('320')).toBe('320');
      expect(DocumentTypeEnum.parse('100')).toBe('100');
      expect(DocumentTypeEnum.parse('710')).toBe('710');
    });

    it('should reject invalid document types', () => {
      expect(() => DocumentTypeEnum.parse('999')).toThrow();
      expect(() => DocumentTypeEnum.parse('ABC')).toThrow();
      expect(() => DocumentTypeEnum.parse('')).toThrow();
    });

    it('should have corresponding labels', () => {
      expect(DocumentTypeLabels['320']).toBe('חשבונית מס קבלה');
      expect(DocumentTypeLabelsEn['320']).toBe('Receipt Tax Invoice');
      expect(DocumentTypeLabels['100']).toBe('הזמנה');
      expect(DocumentTypeLabelsEn['100']).toBe('Order');
    });
  });

  describe('CurrencyCodeEnum', () => {
    it('should validate common currency codes', () => {
      expect(CurrencyCodeEnum.parse('ILS')).toBe('ILS');
      expect(CurrencyCodeEnum.parse('USD')).toBe('USD');
      expect(CurrencyCodeEnum.parse('EUR')).toBe('EUR');
    });

    it('should reject invalid currency codes', () => {
      expect(() => CurrencyCodeEnum.parse('XXX')).toThrow();
      expect(() => CurrencyCodeEnum.parse('123')).toThrow();
      expect(() => CurrencyCodeEnum.parse('')).toThrow();
    });

    it('should have Hebrew labels', () => {
      expect(CurrencyLabels['ILS']).toBe('שקל חדש');
      expect(CurrencyLabels['USD']).toBe('דולר אמריקאי');
      expect(CurrencyLabels['EUR']).toBe('יורו');
    });
  });

  describe('RecordTypeEnum', () => {
    it('should validate all SHAAM record types', () => {
      const expectedTypes: RecordType[] = [
        'A000',
        'A100',
        'B100',
        'B110',
        'C100',
        'D110',
        'D120',
        'M100',
        'Z900',
      ];

      for (const type of expectedTypes) {
        expect(RecordTypeEnum.parse(type)).toBe(type);
      }
    });

    it('should reject invalid record types', () => {
      expect(() => RecordTypeEnum.parse('X999')).toThrow();
      expect(() => RecordTypeEnum.parse('A999')).toThrow();
      expect(() => RecordTypeEnum.parse('')).toThrow();
    });
  });

  describe('SoftwareTypeEnum', () => {
    it('should validate software types', () => {
      expect(SoftwareTypeEnum.parse('1')).toBe('1');
      expect(SoftwareTypeEnum.parse('2')).toBe('2');
    });

    it('should have descriptive labels', () => {
      expect(SoftwareTypeLabels['1']).toBe('Single-year');
      expect(SoftwareTypeLabels['2']).toBe('Multi-year');
    });
  });

  describe('AccountingTypeEnum', () => {
    it('should validate accounting types', () => {
      expect(AccountingTypeEnum.parse('0')).toBe('0');
      expect(AccountingTypeEnum.parse('1')).toBe('1');
      expect(AccountingTypeEnum.parse('2')).toBe('2');
    });

    it('should have descriptive labels', () => {
      expect(AccountingTypeLabels['0']).toBe('N/A');
      expect(AccountingTypeLabels['1']).toBe('Single-entry');
      expect(AccountingTypeLabels['2']).toBe('Double-entry');
    });
  });

  describe('DebitCreditIndicatorEnum', () => {
    it('should validate debit/credit indicators', () => {
      expect(DebitCreditIndicatorEnum.parse('1')).toBe('1');
      expect(DebitCreditIndicatorEnum.parse('2')).toBe('2');
    });

    it('should have descriptive labels', () => {
      expect(DebitCreditIndicatorLabels['1']).toBe('Debit');
      expect(DebitCreditIndicatorLabels['2']).toBe('Credit');
    });
  });

  describe('PaymentMethodEnum', () => {
    it('should validate payment methods', () => {
      expect(PaymentMethodEnum.parse('1')).toBe('1');
      expect(PaymentMethodEnum.parse('3')).toBe('3');
      expect(PaymentMethodEnum.parse('4')).toBe('4');
    });

    it('should have descriptive labels', () => {
      expect(PaymentMethodLabels['1']).toBe('Cash');
      expect(PaymentMethodLabels['3']).toBe('Credit Card');
      expect(PaymentMethodLabels['4']).toBe('Bank Transfer');
    });
  });

  describe('TrialBalanceCodeEnum', () => {
    it('should validate trial balance codes', () => {
      expect(TrialBalanceCodeEnum.parse('Asset')).toBe('Asset');
      expect(TrialBalanceCodeEnum.parse('Liability')).toBe('Liability');
      expect(TrialBalanceCodeEnum.parse('Revenue')).toBe('Revenue');
    });

    it('should have Hebrew labels', () => {
      expect(TrialBalanceCodeLabels['Asset']).toBe('נכסים');
      expect(TrialBalanceCodeLabels['Liability']).toBe('התחייבויות');
      expect(TrialBalanceCodeLabels['Revenue']).toBe('הכנסות');
    });
  });

  describe('CountryCodeEnum', () => {
    it('should validate common country codes', () => {
      expect(CountryCodeEnum.parse('IL')).toBe('IL');
      expect(CountryCodeEnum.parse('US')).toBe('US');
      expect(CountryCodeEnum.parse('DE')).toBe('DE');
    });

    it('should have Hebrew labels', () => {
      expect(CountryLabels['IL']).toBe('ישראל');
      expect(CountryLabels['US']).toBe('ארצות הברית');
      expect(CountryLabels['DE']).toBe('גרמניה');
    });
  });

  describe('SHAAM_CONSTANTS', () => {
    it('should have correct default values', () => {
      expect(SHAAM_CONSTANTS.VERSION).toBe('&OF1.31&');
      expect(SHAAM_CONSTANTS.DEFAULT_CURRENCY).toBe('ILS');
      expect(SHAAM_CONSTANTS.DEFAULT_LANGUAGE).toBe('0');
      expect(SHAAM_CONSTANTS.DEFAULT_ENCODING).toBe('1');
      expect(SHAAM_CONSTANTS.DEFAULT_SOFTWARE_TYPE).toBe('2');
      expect(SHAAM_CONSTANTS.DEFAULT_ACCOUNTING_TYPE).toBe('2');
      expect(SHAAM_CONSTANTS.DEFAULT_BALANCE_REQUIRED).toBe('1');
      expect(SHAAM_CONSTANTS.DEFAULT_BRANCH_INFO).toBe('0');
    });

    it('should have constants that validate against their enums', () => {
      expect(CurrencyCodeEnum.parse(SHAAM_CONSTANTS.DEFAULT_CURRENCY)).toBe('ILS');
      expect(LanguageCodeEnum.parse(SHAAM_CONSTANTS.DEFAULT_LANGUAGE)).toBe('0');
      expect(CharacterEncodingEnum.parse(SHAAM_CONSTANTS.DEFAULT_ENCODING)).toBe('1');
      expect(SoftwareTypeEnum.parse(SHAAM_CONSTANTS.DEFAULT_SOFTWARE_TYPE)).toBe('2');
      expect(AccountingTypeEnum.parse(SHAAM_CONSTANTS.DEFAULT_ACCOUNTING_TYPE)).toBe('2');
      expect(BalanceRequiredEnum.parse(SHAAM_CONSTANTS.DEFAULT_BALANCE_REQUIRED)).toBe('1');
      expect(BranchInfoFlagEnum.parse(SHAAM_CONSTANTS.DEFAULT_BRANCH_INFO)).toBe('0');
    });
  });

  describe('ShaamEnumSchemas', () => {
    it('should provide access to all enum schemas', () => {
      expect(ShaamEnumSchemas.DocumentType).toBe(DocumentTypeEnum);
      expect(ShaamEnumSchemas.CurrencyCode).toBe(CurrencyCodeEnum);
      expect(ShaamEnumSchemas.RecordType).toBe(RecordTypeEnum);
      expect(ShaamEnumSchemas.SoftwareType).toBe(SoftwareTypeEnum);
      expect(ShaamEnumSchemas.AccountingType).toBe(AccountingTypeEnum);
    });
  });

  describe('ShaamLabels', () => {
    it('should provide access to all label mappings', () => {
      expect(ShaamLabels.DocumentType).toBe(DocumentTypeLabels);
      expect(ShaamLabels.DocumentTypeEn).toBe(DocumentTypeLabelsEn);
      expect(ShaamLabels.Currency).toBe(CurrencyLabels);
      expect(ShaamLabels.Country).toBe(CountryLabels);
      expect(ShaamLabels.SoftwareType).toBe(SoftwareTypeLabels);
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct types at compile time', () => {
      // These should compile without errors
      const docType: DocumentType = '320';
      const currency: CurrencyCode = 'ILS';
      const recordType: RecordType = 'A100';
      const softwareType: SoftwareType = '2';
      const accountingType: AccountingType = '2';
      const debitCredit: DebitCreditIndicator = '1';
      const paymentMethod: PaymentMethod = '3';
      const trialBalance: TrialBalanceCode = 'Asset';
      const country: CountryCode = 'IL';

      // Verify they hold the expected values
      expect(docType).toBe('320');
      expect(currency).toBe('ILS');
      expect(recordType).toBe('A100');
      expect(softwareType).toBe('2');
      expect(accountingType).toBe('2');
      expect(debitCredit).toBe('1');
      expect(paymentMethod).toBe('3');
      expect(trialBalance).toBe('Asset');
      expect(country).toBe('IL');
    });
  });

  describe('Coverage and Completeness', () => {
    it('should have all document types covered in both label sets', () => {
      const docTypes = DocumentTypeEnum.options;

      for (const type of docTypes) {
        expect(DocumentTypeLabels[type]).toBeDefined();
        expect(DocumentTypeLabelsEn[type]).toBeDefined();
        expect(typeof DocumentTypeLabels[type]).toBe('string');
        expect(typeof DocumentTypeLabelsEn[type]).toBe('string');
      }
    });

    it('should have all currencies covered in labels', () => {
      const currencies = CurrencyCodeEnum.options;

      for (const currency of currencies) {
        expect(CurrencyLabels[currency]).toBeDefined();
        expect(typeof CurrencyLabels[currency]).toBe('string');
      }
    });

    it('should have all countries covered in labels', () => {
      const countries = CountryCodeEnum.options;

      for (const country of countries) {
        expect(CountryLabels[country]).toBeDefined();
        expect(typeof CountryLabels[country]).toBe('string');
      }
    });
  });
});
