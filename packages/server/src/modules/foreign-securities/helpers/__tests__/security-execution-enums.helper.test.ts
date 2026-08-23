import { describe, expect, it } from 'vitest';
import {
  SecurityPaymentType,
  SecurityTradeType,
  SecurityTransactionType,
} from '../../../../shared/enums.js';
import {
  paymentTypeToRaw,
  toSecurityPaymentType,
  toSecurityTradeType,
  toSecurityTransactionType,
  tradeTypeToRaw,
  transactionTypeToRaw,
} from '../security-execution-enums.helper.js';

describe('toSecurityTradeType', () => {
  it.each([
    ['קניה', SecurityTradeType.Buy],
    ['מכירה', SecurityTradeType.Sell],
    ['דבידנד תשלום', SecurityTradeType.DividendPayment],
    ['ריבית תשלום', SecurityTradeType.InterestPayment],
    ['פדיון', SecurityTradeType.Redemption],
    ['הטבה חלוקת מניות', SecurityTradeType.StockDistribution],
    ['העברה לזכות הפקדון', SecurityTradeType.TransferIn],
    ['העברה לחובת הפקדון', SecurityTradeType.TransferOut],
    ['העברה לזכות הפקדון (דו צדדית)', SecurityTradeType.TransferInTwoSided],
    ['העברה לחובת הפקדון (דו צדדית)', SecurityTradeType.TransferOutTwoSided],
  ])('maps every value the scraper accepts: %s', (raw, expected) => {
    expect(toSecurityTradeType(raw)).toBe(expected);
  });

  it('throws, naming the value and where to widen it', () => {
    expect(() => toSecurityTradeType('פיצול מניות')).toThrow(
      /Unknown trade type "פיצול מניות".*TRADE_TYPES/s,
    );
  });
});

describe('toSecurityTransactionType', () => {
  it.each([
    ['קניה', SecurityTransactionType.Buy],
    ['מכירה', SecurityTransactionType.Sell],
    ['תשלומים ואירועי חברה', SecurityTransactionType.PaymentsAndCorporateActions],
    ['העברות', SecurityTransactionType.Transfers],
  ])('maps every value the scraper accepts: %s', (raw, expected) => {
    expect(toSecurityTransactionType(raw)).toBe(expected);
  });

  it('throws on an unknown value', () => {
    expect(() => toSecurityTransactionType('משהו אחר')).toThrow(/TRANSACTION_TYPES/);
  });
});

describe('toSecurityPaymentType', () => {
  it.each([
    ['דיבידנד', SecurityPaymentType.Dividend],
    ['דיבידנד בעין', SecurityPaymentType.DividendInKind],
    ['ריבית', SecurityPaymentType.Interest],
    // Note the bank spells redemption `פידיון` here and `פדיון` as a trade type.
    ['פידיון', SecurityPaymentType.Redemption],
    ['פקיעה', SecurityPaymentType.Expiration],
    ['איחוד מניות', SecurityPaymentType.ShareConsolidation],
    ['הצעת רכש כפויה', SecurityPaymentType.CompulsoryTenderOffer],
  ])('maps every value the scraper accepts: %s', (raw, expected) => {
    expect(toSecurityPaymentType(raw)).toBe(expected);
  });

  it('passes null through — a plain trade carries no payment type', () => {
    expect(toSecurityPaymentType(null)).toBeNull();
  });

  it('throws on an unknown value', () => {
    expect(() => toSecurityPaymentType('פדיון')).toThrow(/PAYMENT_TYPES/);
  });
});

/**
 * The inverses exist so a filter can push a GraphQL enum into SQL without
 * hand-writing the bank's Hebrew. Round-tripping every enum member is what makes
 * that safe: a forward map that grows a member without its label, or an inverse
 * that resolves to the wrong map, fails here rather than at query time as an
 * empty result nobody can explain.
 */
describe('the reverse maps', () => {
  it.each(Object.values(SecurityTradeType))('round-trips trade type %s', tradeType => {
    const raw = tradeTypeToRaw[tradeType];
    expect(raw, `${tradeType} has no label`).toBeTruthy();
    expect(toSecurityTradeType(raw)).toBe(tradeType);
  });

  it.each(Object.values(SecurityTransactionType))(
    'round-trips transaction type %s',
    transactionType => {
      const raw = transactionTypeToRaw[transactionType];
      expect(raw, `${transactionType} has no label`).toBeTruthy();
      expect(toSecurityTransactionType(raw)).toBe(transactionType);
    },
  );

  it.each(Object.values(SecurityPaymentType))('round-trips payment type %s', paymentType => {
    const raw = paymentTypeToRaw[paymentType];
    expect(raw, `${paymentType} has no label`).toBeTruthy();
    expect(toSecurityPaymentType(raw)).toBe(paymentType);
  });

  /**
   * The reason the inverses are per-map rather than one shared table: the bank
   * spells redemption two ways, and a shared inverse would silently resolve a
   * trade-type redemption to the payment-type spelling (or the reverse), which
   * would then match nothing in the column being filtered.
   */
  it('keeps the two spellings of redemption apart', () => {
    expect(tradeTypeToRaw[SecurityTradeType.Redemption]).toBe('פדיון');
    expect(paymentTypeToRaw[SecurityPaymentType.Redemption]).toBe(
      'פידיון',
    );
    expect(tradeTypeToRaw[SecurityTradeType.Redemption]).not.toBe(
      paymentTypeToRaw[SecurityPaymentType.Redemption],
    );
  });

  /**
   * Buy and sell are spelled identically as a trade type and a transaction type,
   * so an inverse keyed only by the enum member's *name* would be ambiguous. These
   * are separate enums, and the labels agreeing is a fact about the source rather
   * than a collision.
   */
  it('shares the buy/sell labels across the two vocabularies', () => {
    expect(tradeTypeToRaw[SecurityTradeType.Buy]).toBe(
      transactionTypeToRaw[SecurityTransactionType.Buy],
    );
    expect(tradeTypeToRaw[SecurityTradeType.Sell]).toBe(
      transactionTypeToRaw[SecurityTransactionType.Sell],
    );
  });
});
