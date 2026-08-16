import { describe, expect, it } from 'vitest';
import {
  SecurityPaymentType,
  SecurityTradeType,
  SecurityTransactionType,
} from '../../../../shared/enums.js';
import {
  toSecurityPaymentType,
  toSecurityTradeType,
  toSecurityTransactionType,
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
