import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { TestDatabase } from './db-setup.js';
import { ExchangeProvider } from '../../modules/exchange-rates/providers/exchange.provider.js';
import { createLedgerTestContext } from '../../test-utils/ledger-injector.js';
import { mockExchangeRate } from './exchange-mock.js';
import { Currency } from '../../shared/enums.js';
import { EMPTY_UUID } from '../../shared/constants.js';

describe('exchange-mock integration', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = new TestDatabase();
    await db.connect();
    await db.ensureLatestSchema();
    await db.seedAdmin();
  });

  afterAll(async () => {
    await db.close();
  });

  it('should use mocked exchange rate in ledger test context', async () => {
    const client = await db.getPool().connect();
    try {
      // Create test context with mocked USD → ILS rate
      const context = createLedgerTestContext({
        pool: db.getPool(),
        mockExchangeRates: mockExchangeRate(Currency.Usd, Currency.Ils, 3.5),
        businessId: EMPTY_UUID,
      });

      // Retrieve exchange provider and verify mock works
      const exchangeProvider = context.injector.get<ExchangeProvider>(ExchangeProvider);
      const rate = await exchangeProvider.getExchangeRates(
        Currency.Usd,
        Currency.Ils,
        new Date('2024-01-15'),
      );

      expect(rate).toBe(3.5);
    } finally {
      client.release();
    }
  });

  it('should return inverse rate for swapped currency pair', async () => {
    const client = await db.getPool().connect();
    try {
      const context = createLedgerTestContext({
        pool: db.getPool(),
        mockExchangeRates: mockExchangeRate(Currency.Usd, Currency.Ils, 4.0),
        businessId: EMPTY_UUID,
      });

      const exchangeProvider = context.injector.get<ExchangeProvider>(ExchangeProvider);
      const rate = await exchangeProvider.getExchangeRates(
        Currency.Ils,
        Currency.Usd,
        new Date('2024-01-15'),
      );

      expect(rate).toBe(0.25); // 1 / 4.0
    } finally {
      client.release();
    }
  });

  it('should throw error for unmocked currency pairs', async () => {
    const client = await db.getPool().connect();
    try {
      const context = createLedgerTestContext({
        pool: db.getPool(),
        mockExchangeRates: mockExchangeRate(Currency.Usd, Currency.Ils, 3.5),
        businessId: EMPTY_UUID,
      });

      const exchangeProvider = context.injector.get<ExchangeProvider>(ExchangeProvider);

      await expect(
        exchangeProvider.getExchangeRates(Currency.Eur, Currency.Gbp, new Date('2024-01-15')),
      ).rejects.toThrow(/No exchange rate mock configured for EUR → GBP/);
    } finally {
      client.release();
    }
  });

  it('should work without mock (default behavior)', async () => {
    const client = await db.getPool().connect();
    try {
      // Create context WITHOUT mock - should use real provider
      const context = createLedgerTestContext({
        pool: db.getPool(),
        businessId: EMPTY_UUID,
        // No mockExchangeRates provided
      });

      const exchangeProvider = context.injector.get<ExchangeProvider>(ExchangeProvider);

      // Same currency should always return 1
      const rate = await exchangeProvider.getExchangeRates(
        Currency.Ils,
        Currency.Ils,
        new Date('2024-01-15'),
      );

      expect(rate).toBe(1);
    } finally {
      client.release();
    }
  });
});
