import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { graphql, HttpResponse } from 'msw';
import { createUploadClient } from '../graphql/client.js';

const MOCK_URL = 'http://localhost:4000/graphql';
const MOCK_API_KEY = 'test-api-key-123';
const MOCK_RESULT = {
  inserted: 2,
  skipped: 1,
  insertedIds: ['id-1', 'id-2'],
  insertedTransactions: [],
  changedTransactions: [],
};

// ── MSW server ────────────────────────────────────────────────────────────────

let lastAuthHeader: string | null = null;
let lastMutationName: string | null = null;
let lastVariables: Record<string, unknown> = {};

const server = setupServer(
  graphql.link(MOCK_URL).mutation('UploadPoalimIlsTransactions', ({ request, variables }) => {
    lastAuthHeader = request.headers.get('X-API-Key');
    lastMutationName = 'UploadPoalimIlsTransactions';
    lastVariables = variables as Record<string, unknown>;
    return HttpResponse.json({ data: { uploadPoalimIlsTransactions: MOCK_RESULT } });
  }),

  graphql.link(MOCK_URL).mutation('UploadPoalimForeignTransactions', ({ request, variables }) => {
    lastAuthHeader = request.headers.get('X-API-Key');
    lastMutationName = 'UploadPoalimForeignTransactions';
    lastVariables = variables as Record<string, unknown>;
    return HttpResponse.json({ data: { uploadPoalimForeignTransactions: MOCK_RESULT } });
  }),

  graphql.link(MOCK_URL).mutation('UploadPoalimSwiftTransactions', ({ request, variables }) => {
    lastAuthHeader = request.headers.get('X-API-Key');
    lastMutationName = 'UploadPoalimSwiftTransactions';
    lastVariables = variables as Record<string, unknown>;
    return HttpResponse.json({ data: { uploadPoalimSwiftTransactions: MOCK_RESULT } });
  }),

  graphql.link(MOCK_URL).mutation('UploadIsracardTransactions', ({ request, variables }) => {
    lastAuthHeader = request.headers.get('X-API-Key');
    lastMutationName = 'UploadIsracardTransactions';
    lastVariables = variables as Record<string, unknown>;
    return HttpResponse.json({ data: { uploadIsracardTransactions: MOCK_RESULT } });
  }),

  graphql.link(MOCK_URL).mutation('UploadAmexTransactions', ({ request, variables }) => {
    lastAuthHeader = request.headers.get('X-API-Key');
    lastMutationName = 'UploadAmexTransactions';
    lastVariables = variables as Record<string, unknown>;
    return HttpResponse.json({ data: { uploadAmexTransactions: MOCK_RESULT } });
  }),

  graphql.link(MOCK_URL).mutation('UploadCalTransactions', ({ request, variables }) => {
    lastAuthHeader = request.headers.get('X-API-Key');
    lastMutationName = 'UploadCalTransactions';
    lastVariables = variables as Record<string, unknown>;
    return HttpResponse.json({ data: { uploadCalTransactions: MOCK_RESULT } });
  }),

  graphql.link(MOCK_URL).mutation('UploadDiscountTransactions', ({ request, variables }) => {
    lastAuthHeader = request.headers.get('X-API-Key');
    lastMutationName = 'UploadDiscountTransactions';
    lastVariables = variables as Record<string, unknown>;
    return HttpResponse.json({ data: { uploadDiscountTransactions: MOCK_RESULT } });
  }),

  graphql.link(MOCK_URL).mutation('UploadMaxTransactions', ({ request, variables }) => {
    lastAuthHeader = request.headers.get('X-API-Key');
    lastMutationName = 'UploadMaxTransactions';
    lastVariables = variables as Record<string, unknown>;
    return HttpResponse.json({ data: { uploadMaxTransactions: MOCK_RESULT } });
  }),

  graphql.link(MOCK_URL).mutation('UploadCurrencyRates', ({ request, variables }) => {
    lastAuthHeader = request.headers.get('X-API-Key');
    lastMutationName = 'UploadCurrencyRates';
    lastVariables = variables as Record<string, unknown>;
    return HttpResponse.json({ data: { uploadCurrencyRates: MOCK_RESULT } });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  lastAuthHeader = null;
  lastMutationName = null;
  lastVariables = {};
});
afterAll(() => server.close());

// ── Fixtures ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ILS_PAYLOAD: any = {
  transactions: [
    {
      activityDescription: 'Credit',
      activityTypeCode: 1,
      eventAmount: 100,
      eventDate: 20240101,
      valueDate: 20240101,
      serialNumber: 1,
      transactionType: 'REGULAR',
      currentBalance: 5000,
      referenceNumber: 42,
    },
  ],
  retrievalTransactionData: { accountNumber: 100000, branchNumber: 600, bankNumber: 12 },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FOREIGN_PAYLOAD: any = {
  balancesAndLimitsDataList: [
    {
      currencySwiftCode: 'USD',
      currencyCode: 19, // 19 = USD in Poalim currency codes
      transactions: [
        {
          activityDescription: 'Transfer',
          activityTypeCode: 1,
          eventAmount: 500,
          currencySwiftCode: 'USD',
          currencyRate: 3.7,
          currentBalance: 1000,
          referenceNumber: 99,
          transactionType: 'REGULAR',
          executingDate: 20240101,
          validityDate: 20240101,
          valueDate: 20240101,
        },
      ],
    },
  ],
};

const BANK_ACCOUNT = { bankNumber: 12, branchNumber: 600, accountNumber: 100000 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SWIFT_PAYLOAD: any = {
  swiftsList: [
    {
      startDate: 20240101,
      swiftStatusCode: 'OK',
      amount: 1000,
      currencyCodeCatenatedKey: 'USD',
      chargePartyName: 'Test',
      referenceNumber: 'REF-1',
      transferCatenatedId: 'TID-1',
      dataOriginCode: 1,
      details: {
        swiftBankDetails: {
          swiftIsnSerialNumber: '001',
          swiftBankCode: 'BANKUS33',
          orderCustomerName: 'Test Customer',
          beneficiaryEnglishStreetName1: '123 Main St',
          beneficiaryEnglishCityName1: 'New York',
          beneficiaryEnglishCountryName: 'United States',
        },
        swiftTransferDetailsList: [],
      },
    },
  ],
};

const ISRACARD_PAYLOAD: any = [
  {
    Header: { Status: '1', Message: null },
    CardsTransactionsListBean: {
      cardNumberList: ['card 7567'],
      Index0: {
        '@AllCards': 'AllCards',
        CurrentCardTransactions: [
          {
            txnIsrael: [
              {
                cardIndex: '0',
                supplierName: 'Shop',
                dealSum: '100',
                fullPurchaseDate: '01/01/2024',
                purchaseDate: '01/01/2024',
                voucherNumber: '1234',
                voucherNumberRatz: '5678',
              },
            ],
            txnAbroad: null,
          },
        ],
      },
    },
  },
];

const CAL_PAYLOAD = [
  {
    card: '1234',
    month: '2024-01',
    transactions: [
      {
        trnIntId: 'TRN-1',
        merchantName: 'Store',
        trnAmt: 150,
        trnPurchaseDate: '2024-01-15',
        trnCurrencySymbol: 'ILS',
        trnType: 'normal',
        debCrdDate: '2024-02-01',
        amtBeforeConvAndIndex: 150,
        debCrdCurrencySymbol: 'ILS',
      },
    ],
  },
];

const DISCOUNT_PAYLOAD = [
  {
    accountNumber: 'ACC-001',
    month: '2024-01',
    balance: 5000,
    transactions: [
      {
        OperationDate: '20240101',
        ValueDate: '20240101',
        OperationCode: '1',
        OperationDescription: 'Credit',
        OperationAmount: 1000,
        BalanceAfterOperation: 5000,
        OperationNumber: 1,
        OperationDescription2: '',
        OperationDescription3: '',
        OperationBranch: 1,
        OperationBank: 1,
        Channel: 'web',
        ChannelName: 'Web',
        InstituteCode: '1',
        BranchTreasuryNumber: '1',
        Urn: 'urn-1',
        OperationDetailsServiceName: '',
        CommissionChannelCode: '',
        CommissionChannelName: '',
        CommissionTypeName: '',
        BusinessDayDate: '20240101',
        EventName: '',
        CategoryCode: 1,
        CategoryDescCode: 1,
        CategoryDescription: '',
        OperationDescriptionToDisplay: 'Credit',
        OperationOrder: 1,
        IsLastSeen: false,
      },
    ],
  },
];

const MAX_PAYLOAD = [
  {
    accountNumber: '7',
    txns: [
      {
        cardIndex: 7,
        categoryId: 1,
        merchantName: 'Store',
        originalAmount: 200,
        originalCurrency: 'ILS',
        purchaseDate: '2024-01-15',
        uid: 'UID-1',
        planName: 'regular',
        planTypeId: 1,
      },
    ],
  },
];

const CURRENCY_RATES_PAYLOAD = [
  { date: '2024-01-01', currency: 'USD' as const, rate: 3.712 },
  { date: '2024-01-01', currency: 'EUR' as const, rate: 4.01 },
  { date: '2024-01-02', currency: 'USD' as const, rate: 3.72 },
];

// ── Helper ────────────────────────────────────────────────────────────────────

function client() {
  return createUploadClient(MOCK_URL, MOCK_API_KEY);
}

// ── X-API-Key header ──────────────────────────────────────────────────────

describe('X-API-Key header', () => {
  it('sends API key on every request', async () => {
    await client().uploadPoalimIls(ILS_PAYLOAD);
    expect(lastAuthHeader).toBe(MOCK_API_KEY);
  });

  it('uses the apiKey passed to createUploadClient', async () => {
    const c = createUploadClient(MOCK_URL, 'different-key');
    await c.uploadPoalimIls(ILS_PAYLOAD);
    expect(lastAuthHeader).toBe('different-key');
  });
});

// ── Mutation names and variables ──────────────────────────────────────────────

describe('uploadPoalimIls', () => {
  it('sends correct mutation name', async () => {
    await client().uploadPoalimIls(ILS_PAYLOAD);
    expect(lastMutationName).toBe('UploadPoalimIlsTransactions');
  });

  it('embeds accountNumber and branchNumber inside each transaction row', async () => {
    await client().uploadPoalimIls(ILS_PAYLOAD);
    const txns = lastVariables['transactions'] as unknown[];
    expect(Array.isArray(txns)).toBe(true);
    expect((txns[0] as Record<string, unknown>)['accountNumber']).toBe(100000);
    expect((txns[0] as Record<string, unknown>)['branchNumber']).toBe(600);
  });

  it('sends transactions array as variable', async () => {
    await client().uploadPoalimIls(ILS_PAYLOAD);
    expect(Array.isArray(lastVariables['transactions'])).toBe(true);
  });

  it('returns UploadResult', async () => {
    const result = await client().uploadPoalimIls(ILS_PAYLOAD);
    expect(result).toEqual(MOCK_RESULT);
  });
});

describe('uploadPoalimForeign', () => {
  it('sends correct mutation name', async () => {
    await client().uploadPoalimForeign(FOREIGN_PAYLOAD, BANK_ACCOUNT);
    expect(lastMutationName).toBe('UploadPoalimForeignTransactions');
  });

  it('flattens currency entries into a single transactions array', async () => {
    await client().uploadPoalimForeign(FOREIGN_PAYLOAD, BANK_ACCOUNT);
    const txns = lastVariables['transactions'] as unknown[];
    expect(Array.isArray(txns)).toBe(true);
    expect(txns).toHaveLength(1);
    expect((txns[0] as Record<string, unknown>)['currencySwiftCode']).toBe('USD');
  });

  it('returns UploadResult', async () => {
    const result = await client().uploadPoalimForeign(FOREIGN_PAYLOAD, BANK_ACCOUNT);
    expect(result).toEqual(MOCK_RESULT);
  });
});

describe('uploadPoalimSwift', () => {
  it('sends correct mutation name', async () => {
    await client().uploadPoalimSwift(SWIFT_PAYLOAD, BANK_ACCOUNT);
    expect(lastMutationName).toBe('UploadPoalimSwiftTransactions');
  });

  it('sends swifts variable', async () => {
    await client().uploadPoalimSwift(SWIFT_PAYLOAD, BANK_ACCOUNT);
    expect(Array.isArray(lastVariables['swifts'])).toBe(true);
    expect(lastVariables['swifts'] as unknown[]).toHaveLength(1);
  });

  it('returns UploadResult', async () => {
    const result = await client().uploadPoalimSwift(SWIFT_PAYLOAD, BANK_ACCOUNT);
    expect(result).toEqual(MOCK_RESULT);
  });
});

describe('uploadIsracard', () => {
  it('sends correct mutation name', async () => {
    await client().uploadIsracard(ISRACARD_PAYLOAD);
    expect(lastMutationName).toBe('UploadIsracardTransactions');
  });

  it('flattens txnIsrael/txnAbroad entries with card attached', async () => {
    await client().uploadIsracard(ISRACARD_PAYLOAD);
    const txns = lastVariables['transactions'] as unknown[];
    expect(Array.isArray(txns)).toBe(true);
    expect(txns).toHaveLength(1);
    expect((txns[0] as Record<string, unknown>)['card']).toBe('7567');
  });

  it('returns UploadResult', async () => {
    const result = await client().uploadIsracard(ISRACARD_PAYLOAD);
    expect(result).toEqual(MOCK_RESULT);
  });
});

describe('uploadAmex', () => {
  it('sends correct mutation name', async () => {
    await client().uploadAmex(ISRACARD_PAYLOAD);
    expect(lastMutationName).toBe('UploadAmexTransactions');
  });

  it('flattens with card attached', async () => {
    await client().uploadAmex(ISRACARD_PAYLOAD);
    const txns = lastVariables['transactions'] as unknown[];
    expect((txns[0] as Record<string, unknown>)['card']).toBe('7567');
  });

  it('returns UploadResult', async () => {
    const result = await client().uploadAmex(ISRACARD_PAYLOAD);
    expect(result).toEqual(MOCK_RESULT);
  });
});

describe('uploadCal', () => {
  it('sends correct mutation name', async () => {
    await client().uploadCal(CAL_PAYLOAD);
    expect(lastMutationName).toBe('UploadCalTransactions');
  });

  it('flattens to per-transaction rows with card attached', async () => {
    await client().uploadCal(CAL_PAYLOAD);
    const txns = lastVariables['transactions'] as unknown[];
    expect(Array.isArray(txns)).toBe(true);
    expect(txns).toHaveLength(1);
    expect((txns[0] as Record<string, unknown>)['card']).toBe('1234');
    expect((txns[0] as Record<string, unknown>)['trnIntId']).toBe('TRN-1');
  });

  it('returns UploadResult', async () => {
    const result = await client().uploadCal(CAL_PAYLOAD);
    expect(result).toEqual(MOCK_RESULT);
  });
});

describe('uploadDiscount', () => {
  it('sends correct mutation name', async () => {
    await client().uploadDiscount(DISCOUNT_PAYLOAD);
    expect(lastMutationName).toBe('UploadDiscountTransactions');
  });

  it('flattens to per-transaction rows with accountNumber attached', async () => {
    await client().uploadDiscount(DISCOUNT_PAYLOAD);
    const txns = lastVariables['transactions'] as unknown[];
    expect(Array.isArray(txns)).toBe(true);
    expect(txns).toHaveLength(1);
    expect((txns[0] as Record<string, unknown>)['accountNumber']).toBe('ACC-001');
    expect((txns[0] as Record<string, unknown>)['urn']).toBe('urn-1');
  });

  it('returns UploadResult', async () => {
    const result = await client().uploadDiscount(DISCOUNT_PAYLOAD);
    expect(result).toEqual(MOCK_RESULT);
  });
});

describe('uploadMax', () => {
  it('sends correct mutation name', async () => {
    await client().uploadMax(MAX_PAYLOAD);
    expect(lastMutationName).toBe('UploadMaxTransactions');
  });

  it('flattens to per-transaction rows', async () => {
    await client().uploadMax(MAX_PAYLOAD);
    const txns = lastVariables['transactions'] as unknown[];
    expect(Array.isArray(txns)).toBe(true);
    expect(txns).toHaveLength(1);
    expect((txns[0] as Record<string, unknown>)['uid']).toBe('UID-1');
  });

  it('returns UploadResult', async () => {
    const result = await client().uploadMax(MAX_PAYLOAD);
    expect(result).toEqual(MOCK_RESULT);
  });
});

describe('uploadCurrencyRates', () => {
  it('sends correct mutation name', async () => {
    await client().uploadCurrencyRates(CURRENCY_RATES_PAYLOAD);
    expect(lastMutationName).toBe('UploadCurrencyRates');
  });

  it('pivots { date, currency, rate }[] into { exchangeDate, usd, eur, ... }[] rows', async () => {
    await client().uploadCurrencyRates(CURRENCY_RATES_PAYLOAD);
    const rates = lastVariables['rates'] as Array<Record<string, unknown>>;
    expect(Array.isArray(rates)).toBe(true);
    // Two distinct dates in fixture
    expect(rates).toHaveLength(2);
    const jan1 = rates.find(r => r['exchangeDate'] === '2024-01-01')!;
    expect(jan1['usd']).toBe(3.712);
    expect(jan1['eur']).toBe(4.01);
    const jan2 = rates.find(r => r['exchangeDate'] === '2024-01-02')!;
    expect(jan2['usd']).toBe(3.72);
    expect(jan2['eur']).toBeUndefined();
  });

  it('returns UploadResult', async () => {
    const result = await client().uploadCurrencyRates(CURRENCY_RATES_PAYLOAD);
    expect(result).toEqual(MOCK_RESULT);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('error responses', () => {
  it('throws on 4xx HTTP response', async () => {
    server.use(
      graphql.link(MOCK_URL).mutation('UploadPoalimIlsTransactions', () => {
        return HttpResponse.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 });
      }),
    );
    await expect(client().uploadPoalimIls(ILS_PAYLOAD)).rejects.toThrow();
  });

  it('throws on 5xx HTTP response', async () => {
    server.use(
      graphql.link(MOCK_URL).mutation('UploadPoalimIlsTransactions', () => {
        return HttpResponse.json(
          { errors: [{ message: 'Internal Server Error' }] },
          { status: 500 },
        );
      }),
    );
    await expect(client().uploadPoalimIls(ILS_PAYLOAD)).rejects.toThrow();
  });

  it('throws on GraphQL-level errors', async () => {
    server.use(
      graphql.link(MOCK_URL).mutation('UploadPoalimIlsTransactions', () => {
        return HttpResponse.json({
          errors: [{ message: 'Not authenticated', extensions: { code: 'UNAUTHENTICATED' } }],
        });
      }),
    );
    await expect(client().uploadPoalimIls(ILS_PAYLOAD)).rejects.toThrow();
  });
});
