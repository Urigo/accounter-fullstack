import { describe, expect, it } from 'vitest';
import { UUID_REGEX } from '../../shared/constants.js';
import { createBusiness } from './business.js';
import { makeUUID } from './ids.js';
import { CountryCode } from '@modules/countries/types.js';

describe('Factory: Business', () => {
  describe('createBusiness', () => {
    it('should create business with default values', () => {
      const business = createBusiness();

      // Required field with default
      expect(business.id).toBeDefined();
      expect(business.id).toMatch(UUID_REGEX);

      // Boolean defaults
      expect(business.exemptDealer).toBe(false);
      expect(business.isReceiptEnough).toBe(false);
      expect(business.isDocumentsOptional).toBe(false);

      // Null/void defaults
      expect(business.hebrewName).toBeNull();
      expect(business.address).toBeNull();
      expect(business.email).toBeNull();
      expect(business.website).toBeNull();
      expect(business.phoneNumber).toBeNull();
      expect(business.governmentId).toBeNull();
      expect(business.suggestions).toBeNull();
      expect(business.optionalVat).toBe(false); // NOT NULL constraint
      expect(business.country).toBe('ISR'); // NOT NULL constraint, default to Israel
      expect(business.pcn874RecordTypeOverride).toBeNull();
    });

    it('should generate unique IDs by default', () => {
      const business1 = createBusiness();
      const business2 = createBusiness();

      expect(business1.id).not.toBe(business2.id);
    });

    it('should apply overrides correctly', () => {
      const customId = makeUUID('custom-business');
      const business = createBusiness({
        id: customId,
        hebrewName: 'עסק ישראלי',
          country: CountryCode.Israel,
        exemptDealer: true,
        isReceiptEnough: true,
        isDocumentsOptional: true,
      });

      expect(business.id).toBe(customId);
      expect(business.hebrewName).toBe('עסק ישראלי');
        expect(business.country).toBe(CountryCode.Israel);
      expect(business.exemptDealer).toBe(true);
      expect(business.isReceiptEnough).toBe(true);
      expect(business.isDocumentsOptional).toBe(true);
    });

    it('should allow partial overrides', () => {
      const business = createBusiness({
        hebrewName: 'ספק מקומי',
      });

      expect(business.hebrewName).toBe('ספק מקומי');
      expect(business.id).toBeDefined();
      expect(business.exemptDealer).toBe(false);
        expect(business.country).toBe(CountryCode.Israel); // Default value, not null
    });

    it('should preserve all required fields', () => {
      const business = createBusiness();

      // Verify structure matches expected pgtyped interface
      expect(business).toHaveProperty('id');
      expect(business).toHaveProperty('hebrewName');
      expect(business).toHaveProperty('address');
      expect(business).toHaveProperty('email');
      expect(business).toHaveProperty('website');
      expect(business).toHaveProperty('phoneNumber');
      expect(business).toHaveProperty('governmentId');
      expect(business).toHaveProperty('exemptDealer');
      expect(business).toHaveProperty('suggestions');
      expect(business).toHaveProperty('optionalVat');
      expect(business).toHaveProperty('country');
      expect(business).toHaveProperty('pcn874RecordTypeOverride');
      expect(business).toHaveProperty('isReceiptEnough');
      expect(business).toHaveProperty('isDocumentsOptional');
    });

    it('should handle contact information overrides', () => {
      const business = createBusiness({
        email: 'supplier@example.com',
        phoneNumber: '+972-50-1234567',
        website: 'https://example.com',
        address: '123 Main St, Tel Aviv',
      });

      expect(business.email).toBe('supplier@example.com');
      expect(business.phoneNumber).toBe('+972-50-1234567');
      expect(business.website).toBe('https://example.com');
      expect(business.address).toBe('123 Main St, Tel Aviv');
    });

    it('should handle government ID and exempt dealer scenario', () => {
      const business = createBusiness({
        governmentId: '123456789',
        exemptDealer: true,
        optionalVat: true,
      });

      expect(business.governmentId).toBe('123456789');
      expect(business.exemptDealer).toBe(true);
      expect(business.optionalVat).toBe(true);
    });

    it('should allow explicit null overrides', () => {
      const business = createBusiness({
        hebrewName: null,
        country: null,
      });

      expect(business.hebrewName).toBeNull();
      expect(business.country).toBeNull();
    });
  });
});
