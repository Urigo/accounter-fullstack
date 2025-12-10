import { describe, expect, it } from 'vitest';
import { UUID_REGEX } from '../../shared/constants.js';
import { createTransaction } from './transaction.js';
import { makeUUID } from '../../demo-fixtures/helpers/deterministic-uuid.js';

describe('Factory: Transaction', () => {
  describe('createTransaction', () => {
    it('should create transaction with required fields', () => {
      const chargeId = makeUUID('charge', 'charge-1');
      const businessId = makeUUID('business', 'business-1');

      const transaction = createTransaction({
        charge_id: chargeId,
        business_id: businessId,
        amount: '-100.50',
        currency: 'ILS',
        event_date: '2024-01-15',
      });

      // Required fields
      expect(transaction.charge_id).toBe(chargeId);
      expect(transaction.business_id).toBe(businessId);
      expect(transaction.amount).toBe('-100.50');
      expect(transaction.currency).toBe('ILS');
      expect(transaction.event_date).toBe('2024-01-15');

      // Auto-generated fields
      expect(transaction.id).toBeDefined();
      expect(transaction.id).toMatch(UUID_REGEX);
      expect(transaction.account_id).toBeDefined();
      expect(transaction.account_id).toMatch(UUID_REGEX);
      expect(transaction.source_id).toBeDefined();
      expect(transaction.source_id).toMatch(UUID_REGEX);

      // Defaults
      expect(transaction.current_balance).toBe('0');
      expect(transaction.is_fee).toBe(false);
      expect(transaction.source_description).toBeNull();
      expect(transaction.debit_date).toBeNull();
    });

    it('should generate unique IDs by default', () => {
      const chargeId = makeUUID('charge', 'charge-1');
      const businessId = makeUUID('business', 'business-1');

      const transaction1 = createTransaction({
        charge_id: chargeId,
        business_id: businessId,
        amount: '100',
        currency: 'USD',
        event_date: '2024-01-15',
      });

      const transaction2 = createTransaction({
        charge_id: chargeId,
        business_id: businessId,
        amount: '100',
        currency: 'USD',
        event_date: '2024-01-15',
      });

      expect(transaction1.id).not.toBe(transaction2.id);
    });

    it('should accept numeric amount and convert to string', () => {
      const chargeId = makeUUID('charge', 'charge-1');
      const businessId = makeUUID('business', 'business-1');

      const transaction = createTransaction({
        charge_id: chargeId,
        business_id: businessId,
        amount: 100.5,
        currency: 'EUR',
        event_date: '2024-02-01',
      });

      expect(transaction.amount).toBe('100.5');
    });

    it('should accept Date object for event_date and convert to ISO string', () => {
      const chargeId = makeUUID('charge', 'charge-1');
      const businessId = makeUUID('business', 'business-1');
      const date = new Date('2024-03-15T12:00:00Z');

      const transaction = createTransaction({
        charge_id: chargeId,
        business_id: businessId,
        amount: '200',
        currency: 'ILS',
        event_date: date,
      });

      expect(transaction.event_date).toBe('2024-03-15');
    });

    it('should handle is_fee parameter', () => {
      const chargeId = makeUUID('charge', 'charge-1');
      const businessId = makeUUID('business', 'bank');

      const feeTransaction = createTransaction({
        charge_id: chargeId,
        business_id: businessId,
        amount: '-5.00',
        currency: 'USD',
        event_date: '2024-01-15',
        is_fee: true,
      });

      expect(feeTransaction.is_fee).toBe(true);
    });

    it('should apply overrides correctly', () => {
      const chargeId = makeUUID('charge', 'charge-1');
      const businessId = makeUUID('business', 'business-1');
      const customId = makeUUID('transaction', 'custom-tx');
      const accountId = makeUUID('financial-account', 'eur-account');

      const transaction = createTransaction(
        {
          charge_id: chargeId,
          business_id: businessId,
          amount: 500.0,
          currency: 'EUR',
          event_date: '2024-03-10',
        },
        {
          id: customId,
          account_id: accountId,
          source_description: 'Invoice payment EUR',
          debit_date: '2024-03-12',
          current_balance: '15000.00',
        },
      );

      expect(transaction.id).toBe(customId);
      expect(transaction.account_id).toBe(accountId);
      expect(transaction.source_description).toBe('Invoice payment EUR');
      expect(transaction.debit_date).toBe('2024-03-12');
      expect(transaction.current_balance).toBe('15000.00');
    });

    it('should allow partial overrides', () => {
      const chargeId = makeUUID('charge', 'charge-1');
      const businessId = makeUUID('business', 'business-1');

      const transaction = createTransaction(
        {
          charge_id: chargeId,
          business_id: businessId,
          amount: '300',
          currency: 'ILS',
          event_date: '2024-04-01',
        },
        {
          source_description: 'Office rent',
        },
      );

      expect(transaction.source_description).toBe('Office rent');
      expect(transaction.id).toBeDefined();
      expect(transaction.debit_date).toBeNull();
    });

    it('should preserve all required fields', () => {
      const chargeId = makeUUID('charge', 'charge-1');
      const businessId = makeUUID('business', 'business-1');

      const transaction = createTransaction({
        charge_id: chargeId,
        business_id: businessId,
        amount: '100',
        currency: 'USD',
        event_date: '2024-01-01',
      });

      // Verify structure matches expected interface
      expect(transaction).toHaveProperty('id');
      expect(transaction).toHaveProperty('account_id');
      expect(transaction).toHaveProperty('charge_id');
      expect(transaction).toHaveProperty('source_id');
      expect(transaction).toHaveProperty('source_description');
      expect(transaction).toHaveProperty('currency');
      expect(transaction).toHaveProperty('event_date');
      expect(transaction).toHaveProperty('debit_date');
      expect(transaction).toHaveProperty('amount');
      expect(transaction).toHaveProperty('current_balance');
      expect(transaction).toHaveProperty('business_id');
      expect(transaction).toHaveProperty('is_fee');
    });

    it('should handle different currency types', () => {
      const chargeId = makeUUID('charge', 'charge-1');
      const businessId = makeUUID('business', 'business-1');

      const ilsTransaction = createTransaction({
        charge_id: chargeId,
        business_id: businessId,
        amount: '1000',
        currency: 'ILS',
        event_date: '2024-01-01',
      });

      const usdTransaction = createTransaction({
        charge_id: chargeId,
        business_id: businessId,
        amount: '1000',
        currency: 'USD',
        event_date: '2024-01-01',
      });

      const eurTransaction = createTransaction({
        charge_id: chargeId,
        business_id: businessId,
        amount: '1000',
        currency: 'EUR',
        event_date: '2024-01-01',
      });

      expect(ilsTransaction.currency).toBe('ILS');
      expect(usdTransaction.currency).toBe('USD');
      expect(eurTransaction.currency).toBe('EUR');
    });

    it('should handle negative amounts (expenses)', () => {
      const chargeId = makeUUID('charge', 'charge-1');
      const businessId = makeUUID('business', 'supplier');

      const expense = createTransaction({
        charge_id: chargeId,
        business_id: businessId,
        amount: '-500.75',
        currency: 'ILS',
        event_date: '2024-05-01',
      });

      expect(expense.amount).toBe('-500.75');
    });

    it('should handle positive amounts (income)', () => {
      const chargeId = makeUUID('charge', 'charge-1');
      const businessId = makeUUID('business', 'customer');

      const income = createTransaction({
        charge_id: chargeId,
        business_id: businessId,
        amount: '1200.00',
        currency: 'USD',
        event_date: '2024-06-01',
      });

      expect(income.amount).toBe('1200.00');
    });

    it('should allow explicit null overrides', () => {
      const chargeId = makeUUID('charge', 'charge-1');
      const businessId = makeUUID('business', 'business-1');

      const transaction = createTransaction(
        {
          charge_id: chargeId,
          business_id: businessId,
          amount: '100',
          currency: 'ILS',
          event_date: '2024-01-01',
        },
        {
          source_description: null,
          debit_date: null,
          is_fee: null,
        },
      );

      expect(transaction.source_description).toBeNull();
      expect(transaction.debit_date).toBeNull();
      expect(transaction.is_fee).toBeNull();
    });
  });
});
