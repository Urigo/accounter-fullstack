import type { MaxPayload } from '../../payload-schemas/max.schema.js';

type MaxAccount = MaxPayload[number];
type MaxTransaction = MaxAccount['txns'][number];

/**
 * A complete MAX transaction. The schema requires ~30 fields, but tests only ever care about a
 * handful — pass those as overrides and let the rest stay at these defaults.
 */
export function makeMaxTransaction(overrides: Partial<MaxTransaction> = {}): MaxTransaction {
  return {
    actualPaymentAmount: 100,
    arn: null,
    cardIndex: 1,
    categoryId: 1,
    comments: '',
    discountKeyAmount: null,
    discountKeyRecType: null,
    isRegisterCh: false,
    isSpreadingAutorizationAllowed: false,
    issuerId: 1,
    merchantData: {
      address: null,
      coordinates: null,
      maxPhone: false,
      merchant: 'Shop',
      merchantCommercialName: null,
      merchantNumber: '123',
      merchantPhone: '',
      merchantTaxId: null,
    },
    merchantName: 'Shop',
    originalAmount: 100,
    originalCurrency: 'ILS',
    paymentCurrency: null,
    planName: 'regular',
    planTypeId: 1,
    promotionAmount: null,
    promotionClub: null,
    promotionType: null,
    purchaseDate: '2024-01-01T00:00:00',
    refIndex: 1,
    runtimeReference: { id: '1', type: 1 },
    runtimeReferenceId: null,
    shortCardNumber: '1234',
    spreadTransactionByCampainInd: false,
    spreadTransactionByCampainNumber: null,
    tableType: 1,
    tag: null,
    uid: 'uid-1',
    upSaleForTransactionResult: null,
    userIndex: 1,
    ...overrides,
  };
}

export function makeMaxAccount(
  accountNumber: string,
  txns: Partial<MaxTransaction>[] = [{}],
): MaxAccount {
  return { accountNumber, txns: txns.map(makeMaxTransaction) };
}
