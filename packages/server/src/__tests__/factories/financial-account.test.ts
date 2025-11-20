import { describe, expect, it } from 'vitest';
import {
  createFinancialAccount,
  FINANCIAL_ACCOUNT_TYPES,
} from './financial-account.js';
import { makeUUID } from './ids.js';

describe('Factory: Financial Account', () => {
  describe('FINANCIAL_ACCOUNT_TYPES', () => {
    it('should export all valid account types', () => {
      expect(FINANCIAL_ACCOUNT_TYPES).toEqual([
        'BANK_ACCOUNT',
        'BANK_DEPOSIT_ACCOUNT',
        'CREDIT_CARD',
        'CRYPTO_WALLET',
        'FOREIGN_SECURITIES',
      ]);
    });
  });

  describe('createFinancialAccount', () => {
    it('should create financial account with default values', () => {
      const account = createFinancialAccount();

      // Generated default
      expect(account.accountNumber).toBeDefined();
      expect(account.accountNumber).not.toBeNull();
      expect(typeof account.accountNumber).toBe('string');
      if (account.accountNumber) {
        expect(account.accountNumber.length).toBeGreaterThan(0);
      }

      // Type defaults
      expect(account.type).toBe('BANK_ACCOUNT');
      expect(account.privateBusiness).toBe('PRIVATE');

      // Null defaults
      expect(account.name).toBeNull();
      expect(account.ownerId).toBeNull();
    });

    it('should generate unique account numbers by default', () => {
      const account1 = createFinancialAccount();
      const account2 = createFinancialAccount();

      expect(account1.accountNumber).not.toBe(account2.accountNumber);
    });

    it('should apply overrides correctly', () => {
      const ownerId = makeUUID('business-owner');
      const account = createFinancialAccount({
        accountNumber: '123456789',
        name: 'Main Business Account',
        privateBusiness: 'BUSINESS',
        ownerId,
        type: 'CREDIT_CARD',
      });

      expect(account.accountNumber).toBe('123456789');
      expect(account.name).toBe('Main Business Account');
      expect(account.privateBusiness).toBe('BUSINESS');
      expect(account.ownerId).toBe(ownerId);
      expect(account.type).toBe('CREDIT_CARD');
    });

    it('should allow partial overrides', () => {
      const account = createFinancialAccount({
        accountNumber: '987654321',
      });

      expect(account.accountNumber).toBe('987654321');
      expect(account.type).toBe('BANK_ACCOUNT');
      expect(account.privateBusiness).toBe('PRIVATE');
      expect(account.name).toBeNull();
    });

    it('should preserve all required fields', () => {
      const account = createFinancialAccount();

      // Verify structure matches expected pgtyped interface
      expect(account).toHaveProperty('accountNumber');
      expect(account).toHaveProperty('name');
      expect(account).toHaveProperty('privateBusiness');
      expect(account).toHaveProperty('ownerId');
      expect(account).toHaveProperty('type');
    });

    it('should handle all account types', () => {
      for (const accountType of FINANCIAL_ACCOUNT_TYPES) {
        const account = createFinancialAccount({
          type: accountType,
        });

        expect(account.type).toBe(accountType);
      }
    });

    it('should create bank account scenario', () => {
      const ownerId = makeUUID('business');
      const account = createFinancialAccount({
        accountNumber: '12-345-6789',
        type: 'BANK_ACCOUNT',
        ownerId,
        name: 'Business Checking',
        privateBusiness: 'BUSINESS',
      });

      expect(account.type).toBe('BANK_ACCOUNT');
      expect(account.accountNumber).toBe('12-345-6789');
      expect(account.ownerId).toBe(ownerId);
      expect(account.name).toBe('Business Checking');
      expect(account.privateBusiness).toBe('BUSINESS');
    });

    it('should create credit card scenario', () => {
      const ownerId = makeUUID('business');
      const account = createFinancialAccount({
        accountNumber: '4580-****-****-1234',
        type: 'CREDIT_CARD',
        ownerId,
        name: 'Company Visa',
      });

      expect(account.type).toBe('CREDIT_CARD');
      expect(account.accountNumber).toBe('4580-****-****-1234');
      expect(account.name).toBe('Company Visa');
    });

    it('should create crypto wallet scenario', () => {
      const ownerId = makeUUID('business');
      const account = createFinancialAccount({
        accountNumber: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        type: 'CRYPTO_WALLET',
        ownerId,
        name: 'ETH Wallet',
      });

      expect(account.type).toBe('CRYPTO_WALLET');
      expect(account.accountNumber).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
      expect(account.name).toBe('ETH Wallet');
    });

    it('should create bank deposit account scenario', () => {
      const ownerId = makeUUID('business');
      const account = createFinancialAccount({
        accountNumber: 'DEP-123456',
        type: 'BANK_DEPOSIT_ACCOUNT',
        ownerId,
        name: 'Fixed Deposit',
      });

      expect(account.type).toBe('BANK_DEPOSIT_ACCOUNT');
      expect(account.accountNumber).toBe('DEP-123456');
    });

    it('should create foreign securities account scenario', () => {
      const ownerId = makeUUID('business');
      const account = createFinancialAccount({
        accountNumber: 'SEC-US-789',
        type: 'FOREIGN_SECURITIES',
        ownerId,
        name: 'US Stock Portfolio',
      });

      expect(account.type).toBe('FOREIGN_SECURITIES');
      expect(account.accountNumber).toBe('SEC-US-789');
    });

    it('should allow explicit null overrides', () => {
      const account = createFinancialAccount({
        name: null,
        ownerId: null,
      });

      expect(account.name).toBeNull();
      expect(account.ownerId).toBeNull();
    });

    it('should create deterministic accounts with same account number', () => {
      const account1 = createFinancialAccount({ accountNumber: 'ACC-001' });
      const account2 = createFinancialAccount({ accountNumber: 'ACC-001' });

      expect(account1.accountNumber).toBe(account2.accountNumber);
      expect(account1.type).toBe(account2.type);
    });
  });
});
