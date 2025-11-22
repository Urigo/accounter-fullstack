import { describe, expect, it } from 'vitest';
import { UUID_REGEX } from '../../shared/constants.js';
import { createDocument } from './document.js';
import { makeUUID } from './ids.js';

describe('Factory: Document', () => {
  describe('createDocument', () => {
    it('should create document with required fields', () => {
      const chargeId = makeUUID('charge-1');
      const creditorId = makeUUID('supplier-1');
      const debtorId = makeUUID('my-business');

      const document = createDocument({
        charge_id: chargeId,
        creditor_id: creditorId,
        debtor_id: debtorId,
        type: 'INVOICE',
        total_amount: 1000.0,
        currency_code: 'ILS',
        date: '2024-01-15',
      });

      // Required fields
      expect(document.charge_id).toBe(chargeId);
      expect(document.creditor_id).toBe(creditorId);
      expect(document.debtor_id).toBe(debtorId);
      expect(document.type).toBe('INVOICE');
      expect(document.total_amount).toBe(1000.0);
      expect(document.currency_code).toBe('ILS');
      expect(document.date).toBe('2024-01-15');

      // Auto-generated field
      expect(document.id).toBeDefined();
      expect(document.id).toMatch(UUID_REGEX);

      // Null defaults
      expect(document.image_url).toBeNull();
      expect(document.file_url).toBeNull();
      expect(document.serial_number).toBeNull();
      expect(document.vat_amount).toBeNull();
      expect(document.vat_report_date_override).toBeNull();
      expect(document.no_vat_amount).toBeNull();
      expect(document.allocation_number).toBeNull();
      expect(document.exchange_rate_override).toBeNull();
      expect(document.file_hash).toBeNull();
    });

    it('should generate unique IDs by default', () => {
      const chargeId = makeUUID('charge-1');
      const creditorId = makeUUID('supplier-1');
      const debtorId = makeUUID('my-business');

      const document1 = createDocument({
        charge_id: chargeId,
        creditor_id: creditorId,
        debtor_id: debtorId,
        type: 'INVOICE',
        total_amount: 500.0,
        currency_code: 'USD',
        date: '2024-02-01',
      });

      const document2 = createDocument({
        charge_id: chargeId,
        creditor_id: creditorId,
        debtor_id: debtorId,
        type: 'INVOICE',
        total_amount: 500.0,
        currency_code: 'USD',
        date: '2024-02-01',
      });

      expect(document1.id).not.toBe(document2.id);
    });

    it('should accept Date object for date field', () => {
      const chargeId = makeUUID('charge-1');
      const creditorId = makeUUID('supplier-1');
      const debtorId = makeUUID('my-business');
      const date = new Date('2024-03-15T12:00:00Z');

      const document = createDocument({
        charge_id: chargeId,
        creditor_id: creditorId,
        debtor_id: debtorId,
        type: 'RECEIPT',
        total_amount: 750.0,
        currency_code: 'EUR',
        date: date,
      });

      expect(document.date).toEqual(date);
    });

    it('should handle different document types', () => {
      const chargeId = makeUUID('charge-1');
      const creditorId = makeUUID('supplier-1');
      const debtorId = makeUUID('my-business');

      const invoice = createDocument({
        charge_id: chargeId,
        creditor_id: creditorId,
        debtor_id: debtorId,
        type: 'INVOICE',
        total_amount: 1000.0,
        currency_code: 'ILS',
        date: '2024-01-01',
      });

      const receipt = createDocument({
        charge_id: chargeId,
        creditor_id: creditorId,
        debtor_id: debtorId,
        type: 'RECEIPT',
        total_amount: 500.0,
        currency_code: 'ILS',
        date: '2024-01-02',
      });

      const creditInvoice = createDocument({
        charge_id: chargeId,
        creditor_id: creditorId,
        debtor_id: debtorId,
        type: 'CREDIT_INVOICE',
        total_amount: -200.0,
        currency_code: 'ILS',
        date: '2024-01-03',
      });

      expect(invoice.type).toBe('INVOICE');
      expect(receipt.type).toBe('RECEIPT');
      expect(creditInvoice.type).toBe('CREDIT_INVOICE');
    });

    it('should apply overrides correctly', () => {
      const chargeId = makeUUID('charge-1');
      const creditorId = makeUUID('supplier-1');
      const debtorId = makeUUID('my-business');
      const customId = makeUUID('custom-doc');

      const document = createDocument(
        {
          charge_id: chargeId,
          creditor_id: creditorId,
          debtor_id: debtorId,
          type: 'INVOICE',
          total_amount: 2500.0,
          currency_code: 'EUR',
          date: '2024-03-10',
        },
        {
          id: customId,
          serial_number: 'INV-2024-0123',
          vat_amount: 427.35,
          file_url: 'https://storage.example.com/invoices/inv-123.pdf',
          exchange_rate_override: 3.85,
        },
      );

      expect(document.id).toBe(customId);
      expect(document.serial_number).toBe('INV-2024-0123');
      expect(document.vat_amount).toBe(427.35);
      expect(document.file_url).toBe('https://storage.example.com/invoices/inv-123.pdf');
      expect(document.exchange_rate_override).toBe(3.85);
    });

    it('should allow partial overrides', () => {
      const chargeId = makeUUID('charge-1');
      const creditorId = makeUUID('customer-1');
      const debtorId = makeUUID('my-business');

      const document = createDocument(
        {
          charge_id: chargeId,
          creditor_id: creditorId,
          debtor_id: debtorId,
          type: 'RECEIPT',
          total_amount: 500.0,
          currency_code: 'USD',
          date: '2024-02-20',
        },
        {
          vat_amount: 85.47,
          serial_number: 'RCP-2024-001',
        },
      );

      expect(document.vat_amount).toBe(85.47);
      expect(document.serial_number).toBe('RCP-2024-001');
      expect(document.id).toBeDefined();
      expect(document.image_url).toBeNull();
    });

    it('should preserve all required fields', () => {
      const chargeId = makeUUID('charge-1');
      const creditorId = makeUUID('supplier-1');
      const debtorId = makeUUID('my-business');

      const document = createDocument({
        charge_id: chargeId,
        creditor_id: creditorId,
        debtor_id: debtorId,
        type: 'INVOICE',
        total_amount: 1000.0,
        currency_code: 'ILS',
        date: '2024-01-01',
      });

      // Verify structure matches expected interface
      expect(document).toHaveProperty('id');
      expect(document).toHaveProperty('image_url');
      expect(document).toHaveProperty('file_url');
      expect(document).toHaveProperty('type');
      expect(document).toHaveProperty('serial_number');
      expect(document).toHaveProperty('date');
      expect(document).toHaveProperty('total_amount');
      expect(document).toHaveProperty('currency_code');
      expect(document).toHaveProperty('vat_amount');
      expect(document).toHaveProperty('charge_id');
      expect(document).toHaveProperty('debtor_id');
      expect(document).toHaveProperty('creditor_id');
      expect(document).toHaveProperty('vat_report_date_override');
      expect(document).toHaveProperty('no_vat_amount');
      expect(document).toHaveProperty('allocation_number');
      expect(document).toHaveProperty('exchange_rate_override');
      expect(document).toHaveProperty('file_hash');
    });

    it('should handle different currency codes', () => {
      const chargeId = makeUUID('charge-1');
      const creditorId = makeUUID('supplier-1');
      const debtorId = makeUUID('my-business');

      const ilsDoc = createDocument({
        charge_id: chargeId,
        creditor_id: creditorId,
        debtor_id: debtorId,
        type: 'INVOICE',
        total_amount: 1000.0,
        currency_code: 'ILS',
        date: '2024-01-01',
      });

      const usdDoc = createDocument({
        charge_id: chargeId,
        creditor_id: creditorId,
        debtor_id: debtorId,
        type: 'INVOICE',
        total_amount: 500.0,
        currency_code: 'USD',
        date: '2024-01-02',
      });

      const eurDoc = createDocument({
        charge_id: chargeId,
        creditor_id: creditorId,
        debtor_id: debtorId,
        type: 'INVOICE',
        total_amount: 750.0,
        currency_code: 'EUR',
        date: '2024-01-03',
      });

      expect(ilsDoc.currency_code).toBe('ILS');
      expect(usdDoc.currency_code).toBe('USD');
      expect(eurDoc.currency_code).toBe('EUR');
    });

    it('should handle VAT amount', () => {
      const chargeId = makeUUID('charge-1');
      const creditorId = makeUUID('supplier-1');
      const debtorId = makeUUID('my-business');

      const document = createDocument(
        {
          charge_id: chargeId,
          creditor_id: creditorId,
          debtor_id: debtorId,
          type: 'INVOICE',
          total_amount: 1170.0,
          currency_code: 'ILS',
          date: '2024-04-01',
        },
        {
          vat_amount: 170.0, // 17% VAT on 1000
        },
      );

      expect(document.total_amount).toBe(1170.0);
      expect(document.vat_amount).toBe(170.0);
    });

    it('should handle file URLs and image URLs', () => {
      const chargeId = makeUUID('charge-1');
      const creditorId = makeUUID('supplier-1');
      const debtorId = makeUUID('my-business');

      const document = createDocument(
        {
          charge_id: chargeId,
          creditor_id: creditorId,
          debtor_id: debtorId,
          type: 'INVOICE',
          total_amount: 800.0,
          currency_code: 'USD',
          date: '2024-05-01',
        },
        {
          file_url: 'https://example.com/docs/invoice.pdf',
          image_url: 'https://example.com/images/invoice-thumb.jpg',
        },
      );

      expect(document.file_url).toBe('https://example.com/docs/invoice.pdf');
      expect(document.image_url).toBe('https://example.com/images/invoice-thumb.jpg');
    });

    it('should handle negative amounts for credit invoices', () => {
      const chargeId = makeUUID('charge-1');
      const creditorId = makeUUID('supplier-1');
      const debtorId = makeUUID('my-business');

      const creditInvoice = createDocument({
        charge_id: chargeId,
        creditor_id: creditorId,
        debtor_id: debtorId,
        type: 'CREDIT_INVOICE',
        total_amount: -300.0,
        currency_code: 'ILS',
        date: '2024-06-01',
      });

      expect(creditInvoice.total_amount).toBe(-300.0);
      expect(creditInvoice.type).toBe('CREDIT_INVOICE');
    });

    it('should allow explicit null overrides', () => {
      const chargeId = makeUUID('charge-1');
      const creditorId = makeUUID('supplier-1');
      const debtorId = makeUUID('my-business');

      const document = createDocument(
        {
          charge_id: chargeId,
          creditor_id: creditorId,
          debtor_id: debtorId,
          type: 'INVOICE',
          total_amount: 1000.0,
          currency_code: 'ILS',
          date: '2024-01-01',
        },
        {
          serial_number: null,
          vat_amount: null,
          image_url: null,
        },
      );

      expect(document.serial_number).toBeNull();
      expect(document.vat_amount).toBeNull();
      expect(document.image_url).toBeNull();
    });
  });
});
