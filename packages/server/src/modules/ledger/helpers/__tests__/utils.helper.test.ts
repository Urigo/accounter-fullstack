import { describe, expect, it } from 'vitest';
import { TEST_TIMEZONES, useTimezone } from '../../../../__tests__/helpers/timezones.js';
import { Currency } from '../../../../shared/enums.js';
import { timelessDateToTenantInstant } from '../../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import {
  at,
  buildTransaction,
  type TransactionInput,
} from '../../resolvers/ledger-generation/__tests__/helpers/ledger-generation-mocks.js';
import {
  exchangeRatePointKey,
  generatePartialLedgerEntry,
  validateTransactionBasicVariables,
  validateTransactionRequiredVariables,
} from '../utils.helper.js';

/*
 * Ledger entries are dated by day (#4560), but crypto rows are priced at their exact
 * `debit_timestamp`. These helpers keep both: the day for the ledger, the instant for exchange
 * rates, and a key that tells same-day entries priced at different times apart.
 *
 * All IDs, amounts and dates below are made up.
 */

const DAY: TimelessDateString = '2025-03-12';
const OVERRIDE_DAY: TimelessDateString = '2025-03-15';

function transaction(overrides: Partial<TransactionInput> = {}) {
  return buildTransaction({
    id: 'transaction',
    chargeId: 'charge',
    ownerId: 'owner',
    accountId: 'account',
    businessId: 'business',
    amount: '-10',
    currency: Currency.Usd,
    debitDate: DAY,
    ...overrides,
  });
}

describe.each(TEST_TIMEZONES)('ledger transaction dates (TZ=%s)', timeZone => {
  useTimezone(timeZone);

  describe('validateTransactionBasicVariables', () => {
    it('values a crypto row on the day of its debit time, and prices it at the time itself', () => {
      const debitTime = at(DAY, 23, 50);

      const { valueDate, exchangeRateDate } = validateTransactionBasicVariables(
        transaction({ currency: Currency.Eth, debitTimestamp: debitTime }),
      );

      expect(valueDate).toBe(DAY);
      expect(exchangeRateDate).toBe(debitTime);
    });

    it('values and prices a fiat row by its debit date', () => {
      const { valueDate, exchangeRateDate } = validateTransactionBasicVariables(transaction());

      expect(valueDate).toBe(DAY);
      expect(exchangeRateDate).toBe(DAY);
    });

    it('prefers the debit date override for a fiat row', () => {
      const { valueDate, exchangeRateDate } = validateTransactionBasicVariables({
        ...transaction(),
        debit_date_override: OVERRIDE_DAY,
      });

      expect(valueDate).toBe(OVERRIDE_DAY);
      expect(exchangeRateDate).toBe(OVERRIDE_DAY);
    });
  });

  describe('validateTransactionRequiredVariables + generatePartialLedgerEntry', () => {
    it('carries a crypto row’s debit time into the entry, next to its day', () => {
      const debitTime = at(DAY, 0, 5);

      const validated = validateTransactionRequiredVariables(
        transaction({ currency: Currency.Eth, debitTimestamp: debitTime }),
      );
      const entry = generatePartialLedgerEntry(validated, 'owner', 10_000);

      expect(validated.value_date).toBe(DAY);
      expect(validated.exchange_rate_date).toBe(debitTime);
      expect(entry.valueDate).toBe(DAY);
      expect(entry.exchangeRateDate).toBe(debitTime);
    });

    it('lets a debit date override win over the debit time', () => {
      const validated = validateTransactionRequiredVariables({
        ...transaction({ currency: Currency.Eth, debitTimestamp: at(DAY, 10, 15) }),
        debit_date_override: OVERRIDE_DAY,
      });
      const entry = generatePartialLedgerEntry(validated, 'owner', 10_000);

      expect(entry.valueDate).toBe(OVERRIDE_DAY);
      expect(entry.exchangeRateDate).toBe(OVERRIDE_DAY);
    });
  });

  describe('exchangeRatePointKey', () => {
    it('tells apart same-day crypto entries priced at different times', () => {
      const withdrawal = { currency: Currency.Grt, valueDate: DAY, exchangeRateDate: at(DAY, 10, 15) };
      const deposit = { currency: Currency.Grt, valueDate: DAY, exchangeRateDate: at(DAY, 10, 42, 30) };

      expect(exchangeRatePointKey(withdrawal)).not.toBe(exchangeRatePointKey(deposit));
    });

    it('matches crypto entries priced at the same instant', () => {
      const fee = { currency: Currency.Eth, valueDate: DAY, exchangeRateDate: at(DAY, 10, 15) };
      const feePaidByShareholder = {
        currency: Currency.Eth,
        valueDate: DAY,
        exchangeRateDate: at(DAY, 10, 15),
      };

      expect(exchangeRatePointKey(fee)).toBe(exchangeRatePointKey(feePaidByShareholder));
    });

    it("matches a crypto day and a crypto time at the tenant's midnight, which get the same rate", () => {
      const invoice = { currency: Currency.Usdc, valueDate: DAY };
      const paymentAtMidnight = {
        currency: Currency.Usdc,
        valueDate: DAY,
        exchangeRateDate: timelessDateToTenantInstant(DAY),
      };

      expect(exchangeRatePointKey(invoice)).toBe(exchangeRatePointKey(paymentAtMidnight));
    });

    it('keys fiat and local currency by day, whatever the time of day', () => {
      const fiatTransfer = { currency: Currency.Usd, valueDate: DAY, exchangeRateDate: DAY };
      const timedMiscExpense = {
        currency: Currency.Ils,
        valueDate: DAY,
        exchangeRateDate: at(DAY, 15, 39),
      };
      const timedFiatRow = { currency: Currency.Usd, valueDate: DAY, exchangeRateDate: at(DAY, 23, 50) };

      expect(exchangeRatePointKey(fiatTransfer)).toBe(DAY);
      expect(exchangeRatePointKey(timedMiscExpense)).toBe(DAY);
      expect(exchangeRatePointKey(timedFiatRow)).toBe(DAY);
    });

    it('tells apart entries on different days', () => {
      expect(exchangeRatePointKey({ currency: Currency.Usd, valueDate: DAY })).not.toBe(
        exchangeRatePointKey({ currency: Currency.Usd, valueDate: OVERRIDE_DAY }),
      );
      expect(exchangeRatePointKey({ currency: Currency.Eth, valueDate: DAY })).not.toBe(
        exchangeRatePointKey({ currency: Currency.Eth, valueDate: OVERRIDE_DAY }),
      );
    });
  });
});
