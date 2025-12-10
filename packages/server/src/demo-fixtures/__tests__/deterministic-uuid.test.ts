import { describe, expect, it } from 'vitest';
import { makeUUID } from '../helpers/deterministic-uuid.js';

describe('deterministic-uuid', () => {
  describe('makeUUID', () => {
    it('generates same UUID for same inputs', () => {
      const uuid1 = makeUUID('business', 'acme-consulting-llc');
      const uuid2 = makeUUID('business', 'acme-consulting-llc');

      expect(uuid1).toBe(uuid2);
      expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('generates different UUIDs for different names', () => {
      const uuid1 = makeUUID('business', 'acme-llc');
      const uuid2 = makeUUID('business', 'acme-corp');

      expect(uuid1).not.toBe(uuid2);
    });

    it('generates different UUIDs for different namespaces', () => {
      const businessUUID = makeUUID('business', 'acme');
      const chargeUUID = makeUUID('charge', 'acme');

      expect(businessUUID).not.toBe(chargeUUID);
    });

    it('includes namespace in composite key', () => {
      // Same name, different namespace types
      const bizUUID = makeUUID('business', 'test-entity');
      const transactionUUID = makeUUID('transaction', 'test-entity');
      const documentUUID = makeUUID('document', 'test-entity');

      expect(bizUUID).not.toBe(transactionUUID);
      expect(bizUUID).not.toBe(documentUUID);
      expect(transactionUUID).not.toBe(documentUUID);
    });

    it('generates valid UUID v5 format', () => {
      const uuid = makeUUID('charge', 'monthly-invoice-2024-11');

      // UUID v5 format: xxxxxxxx-xxxx-5xxx-yxxx-xxxxxxxxxxxx
      // where y is one of [8, 9, a, b]
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('handles kebab-case names correctly', () => {
      const uuid1 = makeUUID('business', 'us-supplier-acme-llc');
      const uuid2 = makeUUID('business', 'us-supplier-acme-llc');

      expect(uuid1).toBe(uuid2);
    });

    it('handles numeric components in names', () => {
      const uuid1 = makeUUID('charge', 'invoice-2024-11-15');
      const uuid2 = makeUUID('charge', 'invoice-2024-11-15');

      expect(uuid1).toBe(uuid2);
    });

    it('is case-sensitive for names', () => {
      const uuid1 = makeUUID('business', 'acme-llc');
      const uuid2 = makeUUID('business', 'ACME-LLC');

      expect(uuid1).not.toBe(uuid2);
    });

    it('is case-sensitive for namespaces', () => {
      const uuid1 = makeUUID('business', 'acme');
      const uuid2 = makeUUID('Business', 'acme');

      expect(uuid1).not.toBe(uuid2);
    });
  });
});
