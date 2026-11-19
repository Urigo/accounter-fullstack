import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChargeTypeEnum } from '../../../../shared/enums.js';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { getChargeType } from '../../../charges/helpers/charge-type.js';
import {
  getChargeBusinesses,
  getChargeDocumentsMeta,
} from '../../../charges/helpers/common.helper.js';
import { mergeChargesExecutor } from '../../../charges/helpers/merge-charges.helper.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../../charges/types.js';
import { syncDeelDocuments } from '../../../deel/helpers/sync-deel-documents.helper.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { ProviderCredentialsProvider } from '../../../provider-credentials/providers/provider-credentials.provider.js';
import {
  autoLinkCreditCardStatements,
  type AutoLinkedStatements,
  type AutoLinkOutcome,
} from '../../../transactions/helpers/link-creditcard-statements.helper.js';
import { CreditCardStatementsProvider } from '../../../transactions/providers/creditcard-statements.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import { ManualAutomationsProvider } from '../../providers/manual-automations.provider.js';
import type { IGetReferenceMergeCandidatesResult } from '../../types.js';
import {
  buildMergedChargeSnapshots,
  creditcardLinksChangeAccounting,
  runManualAutomations,
  type ManualAutomationEventProto,
} from '../run-manual-automations.helper.js';

vi.mock('../../../charges/helpers/merge-charges.helper.js', () => ({
  mergeChargesExecutor: vi.fn(),
}));
vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));
vi.mock('../../../deel/helpers/sync-deel-documents.helper.js', () => ({
  syncDeelDocuments: vi.fn(),
}));
vi.mock('../../../transactions/helpers/link-creditcard-statements.helper.js', () => ({
  autoLinkCreditCardStatements: vi.fn(),
}));
vi.mock('../../../charges/helpers/common.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../charges/helpers/common.helper.js')>()),
  getChargeBusinesses: vi.fn(),
  getChargeDocumentsMeta: vi.fn(),
}));
vi.mock('../../../charges/helpers/charge-type.js', () => ({
  getChargeType: vi.fn(),
  forgetDerivedChargeType: vi.fn(),
}));

function linkingRun(
  linked: AutoLinkedStatements[],
  outcome: Partial<AutoLinkOutcome> = {},
): AsyncGenerator<AutoLinkedStatements, AutoLinkOutcome, undefined> {
  return (async function* () {
    yield* linked;
    return { linkedCount: linked.length, errors: [], ...outcome };
  })();
}

function buildCharge(
  id: string,
  overrides: Partial<IGetChargesByIdsResult> = {},
): IGetChargesByIdsResult {
  return {
    id,
    accountant_status: 'PENDING',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    documents_optional_flag: false,
    invoice_payment_currency_diff: null,
    is_property: false,
    optional_vat: false,
    owner_id: 'owner-1',
    tax_category_id: null,
    type: 'COMMON',
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    user_description: null,
    ...overrides,
  };
}

function buildCandidate(
  id: string,
  chargeId: string,
  overrides: Partial<IGetReferenceMergeCandidatesResult> = {},
): IGetReferenceMergeCandidatesResult {
  return {
    id,
    account_id: 'account-1',
    amount: '10.00',
    business_id: null,
    charge_id: chargeId,
    counter_account: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    currency: 'ILS',
    currency_rate: '1',
    current_balance: '0',
    debit_date: null,
    debit_date_override: null,
    debit_timestamp: null,
    event_date: '2026-01-10',
    is_fee: false,
    origin_key: 'origin-key',
    origin_user_description: null,
    owner_id: 'owner-1',
    source_description: null,
    source_id: `source-${id}`,
    source_origin: 'POALIM_ILS',
    source_reference: 'REF-1',
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

type ManualAutomationsProviderMock = {
  flagForeignFeeTransactions: ReturnType<typeof vi.fn>;
  getReferenceMergeCandidates: ReturnType<typeof vi.fn>;
  calculateCreditcardDebitDate: ReturnType<typeof vi.fn>;
};

function buildInjector(
  manualAutomationsProvider: ManualAutomationsProviderMock,
  charges: IGetChargesByIdsResult[],
  { deelCredentials = null }: { deelCredentials?: { apiToken: string } | null } = {},
) {
  const providers = new Map<unknown, unknown>([
    [ProviderCredentialsProvider, { getDeelCredentials: async () => deelCredentials }],
    [ManualAutomationsProvider, manualAutomationsProvider],
    [
      AdminContextProvider,
      {
        getVerifiedAdminContext: async () => ({
          ownerId: 'owner-1',
          financialAccounts: { creditCardIds: ['issuer-1'] },
        }),
      },
    ],
    [
      ChargesProvider,
      {
        getChargeByIdLoader: {
          loadMany: async (ids: string[]) =>
            ids.map(id => charges.find(charge => charge.id === id)),
        },
      },
    ],
    [TransactionsProvider, { transactionByIdLoader: { clear: vi.fn() } }],
  ]);
  return { get: (token: unknown) => providers.get(token) } as unknown as Injector;
}

async function collect(events: AsyncIterable<ManualAutomationEventProto>) {
  const result: ManualAutomationEventProto[] = [];
  for await (const event of events) {
    result.push(event);
  }
  return result;
}

function statuses(events: ManualAutomationEventProto[]) {
  return events
    .filter(event => event.__typename === 'ManualAutomationStepStatus')
    .map(event => `${event.step}:${event.state}`);
}

describe('buildMergedChargeSnapshots', () => {
  it('describes each charge from its matched transactions', () => {
    const candidates = [
      buildCandidate('t1', 'charge-a', {
        amount: '-100.5',
        event_date: '2026-02-03',
        source_description: 'Bank transfer',
      }),
      buildCandidate('t2', 'charge-a', { amount: '-4.5', event_date: '2026-02-01' }),
      buildCandidate('t3', 'charge-b', { amount: '10', currency: 'USD' }),
      buildCandidate('t4', 'charge-b', { amount: '10', currency: 'EUR' }),
    ];
    const chargeById = new Map([
      ['charge-a', buildCharge('charge-a')],
      ['charge-b', buildCharge('charge-b', { user_description: ' Custom description ' })],
    ]);

    const [chargeA, chargeB] = buildMergedChargeSnapshots(
      ['charge-a', 'charge-b'],
      candidates,
      chargeById,
    );

    expect(chargeA).toMatchObject({
      id: 'charge-a',
      description: 'Bank transfer',
      date: '2026-02-01',
      amount: { raw: -105, currency: 'ILS' },
    });
    // mixed currencies have no meaningful total
    expect(chargeB).toMatchObject({
      id: 'charge-b',
      description: 'Custom description',
      amount: null,
    });
  });
});

describe('runManualAutomations', () => {
  beforeEach(() => {
    vi.mocked(mergeChargesExecutor).mockReset().mockResolvedValue(undefined);
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
    vi.mocked(syncDeelDocuments).mockReset().mockResolvedValue({ charges: [] });
    vi.mocked(autoLinkCreditCardStatements)
      .mockReset()
      .mockImplementation(() => linkingRun([]));
  });

  it('streams every change and a status per step', async () => {
    const charges = [buildCharge('charge-a'), buildCharge('charge-b')];
    const injector = buildInjector(
      {
        flagForeignFeeTransactions: vi.fn().mockResolvedValue([{ id: 'fee-1' }, { id: 'fee-2' }]),
        getReferenceMergeCandidates: vi
          .fn()
          .mockResolvedValue([
            buildCandidate('t1', 'charge-a', { amount: '-100' }),
            buildCandidate('t2', 'charge-b', { amount: '-1', is_fee: true }),
          ]),
        calculateCreditcardDebitDate: vi
          .fn()
          .mockResolvedValue([{ id: 'cc-1', debit_date_override: '2026-03-02' }]),
      },
      charges,
      { deelCredentials: { apiToken: 'token' } },
    );
    const deelCharge = buildCharge('deel-charge');
    vi.mocked(syncDeelDocuments).mockResolvedValue({
      charges: [{ charge: deelCharge, isNew: true, invoiceCount: 2 }],
    });
    const linkedStatement = {
      cardAccountId: 'card-1',
      currency: 'ILS',
      debitDate: '2026-03-02' as const,
      bankTransactionId: 'bank-1',
      linkMethod: 'REFERENCE' as const,
      confirmed: true,
    };
    vi.mocked(autoLinkCreditCardStatements).mockImplementation(() =>
      linkingRun([
        {
          bankTransactionId: 'bank-1',
          chargeId: 'charge-card',
          method: 'REFERENCE',
          statements: [linkedStatement],
          changesAccounting: false,
        },
      ]),
    );

    const events = await collect(runManualAutomations(injector, 'owner-1'));

    expect(statuses(events)).toEqual([
      'FLAG_FOREIGN_FEES:RUNNING',
      'FLAG_FOREIGN_FEES:SUCCEEDED',
      'MERGE_CHARGES_BY_REFERENCE:RUNNING',
      'MERGE_CHARGES_BY_REFERENCE:SUCCEEDED',
      'FILL_CREDITCARD_DEBIT_DATES:RUNNING',
      'FILL_CREDITCARD_DEBIT_DATES:SUCCEEDED',
      'LINK_CREDITCARD_STATEMENTS:RUNNING',
      'LINK_CREDITCARD_STATEMENTS:SUCCEEDED',
      'FETCH_DEEL_DOCUMENTS:RUNNING',
      'FETCH_DEEL_DOCUMENTS:SUCCEEDED',
    ]);
    expect(events.filter(event => event.__typename !== 'ManualAutomationStepStatus')).toEqual([
      { __typename: 'ForeignFeeTransactionFlagged', transaction: 'fee-1' },
      { __typename: 'ForeignFeeTransactionFlagged', transaction: 'fee-2' },
      {
        __typename: 'ChargesMergedByReference',
        reference: 'REF-1',
        baseCharge: charges[0],
        mergedCharges: [expect.objectContaining({ id: 'charge-b', date: '2026-01-10' })],
      },
      { __typename: 'CreditcardDebitDateFilled', transaction: 'cc-1', debitDate: '2026-03-02' },
      {
        __typename: 'CreditcardStatementsLinked',
        bankTransaction: 'bank-1',
        method: 'REFERENCE',
        statements: [linkedStatement],
        degradedCharge: null,
      },
      { __typename: 'DeelChargeSynced', charge: deelCharge, isNew: true, invoiceCount: 2 },
    ]);
    expect(mergeChargesExecutor).toHaveBeenCalledWith(['charge-b'], 'charge-a', injector);
    expect(syncDeelDocuments).toHaveBeenCalledWith(injector);
    expect(
      injector.get(ManualAutomationsProvider).calculateCreditcardDebitDate,
    ).toHaveBeenCalledWith({ ownerId: 'owner-1', creditCardBusinessIds: ['issuer-1'] });
    expect(autoLinkCreditCardStatements).toHaveBeenCalledWith(injector, {
      ownerId: 'owner-1',
      creditCardBusinessIds: ['issuer-1'],
      assessLink: expect.any(Function),
    });
    // the link changed nothing the accountant approved
    expect(degradeChargesAccountantApproval).not.toHaveBeenCalledWith(injector, ['charge-card']);
    // linking step status, then the Deel step's RUNNING, synced charge and SUCCEEDED
    expect(events.at(-4)).toMatchObject({
      step: 'LINK_CREDITCARD_STATEMENTS',
      affectedCount: 1,
      errors: null,
    });
    expect(events.at(-1)).toMatchObject({ affectedCount: 1, errors: null });
  });

  it('skips the remaining steps once a step fails', async () => {
    const injector = buildInjector(
      {
        flagForeignFeeTransactions: vi.fn().mockRejectedValue(new Error('DB is down')),
        getReferenceMergeCandidates: vi.fn(),
        calculateCreditcardDebitDate: vi.fn(),
      },
      [],
    );

    const events = await collect(runManualAutomations(injector, 'owner-1'));

    expect(statuses(events)).toEqual([
      'FLAG_FOREIGN_FEES:RUNNING',
      'FLAG_FOREIGN_FEES:FAILED',
      'MERGE_CHARGES_BY_REFERENCE:SKIPPED',
      'FILL_CREDITCARD_DEBIT_DATES:SKIPPED',
      'LINK_CREDITCARD_STATEMENTS:SKIPPED',
      'FETCH_DEEL_DOCUMENTS:SKIPPED',
    ]);
    expect(events[1]).toMatchObject({ errors: ['DB is down'] });
    expect(syncDeelDocuments).not.toHaveBeenCalled();
  });

  it('marks the Deel step as not configured when the business has no Deel credentials', async () => {
    const injector = buildInjector(
      {
        flagForeignFeeTransactions: vi.fn().mockResolvedValue([]),
        getReferenceMergeCandidates: vi.fn().mockResolvedValue([]),
        calculateCreditcardDebitDate: vi.fn().mockResolvedValue([]),
      },
      [],
    );

    const events = await collect(runManualAutomations(injector, 'owner-1'));

    expect(statuses(events).slice(-2)).toEqual([
      'FETCH_DEEL_DOCUMENTS:RUNNING',
      'FETCH_DEEL_DOCUMENTS:NOT_CONFIGURED',
    ]);
    expect(events.at(-1)).toMatchObject({ affectedCount: 0, errors: null });
    expect(syncDeelDocuments).not.toHaveBeenCalled();
  });

  it('reports the underlying cause when the Deel step fails', async () => {
    const injector = buildInjector(
      {
        flagForeignFeeTransactions: vi.fn().mockResolvedValue([]),
        getReferenceMergeCandidates: vi.fn().mockResolvedValue([]),
        calculateCreditcardDebitDate: vi.fn().mockResolvedValue([]),
      },
      [],
      { deelCredentials: { apiToken: 'token' } },
    );
    vi.mocked(syncDeelDocuments).mockRejectedValue(
      new Error('Error fetching Deel invoices', {
        cause: new Error('Deel contract ID [c-1] not found in DB'),
      }),
    );

    const events = await collect(runManualAutomations(injector, 'owner-1'));

    expect(statuses(events)).toEqual([
      'FLAG_FOREIGN_FEES:RUNNING',
      'FLAG_FOREIGN_FEES:SUCCEEDED',
      'MERGE_CHARGES_BY_REFERENCE:RUNNING',
      'MERGE_CHARGES_BY_REFERENCE:SUCCEEDED',
      'FILL_CREDITCARD_DEBIT_DATES:RUNNING',
      'FILL_CREDITCARD_DEBIT_DATES:SUCCEEDED',
      'LINK_CREDITCARD_STATEMENTS:RUNNING',
      'LINK_CREDITCARD_STATEMENTS:SUCCEEDED',
      'FETCH_DEEL_DOCUMENTS:RUNNING',
      'FETCH_DEEL_DOCUMENTS:FAILED',
    ]);
    expect(events.at(-1)).toMatchObject({
      errors: ['Error fetching Deel invoices: Deel contract ID [c-1] not found in DB'],
    });
  });

  it.each([
    [
      'a GraphQLError cause',
      new GraphQLError('Deel credentials not configured for this tenant'),
      'Error fetching Deel receipts: Deel credentials not configured for this tenant',
    ],
    [
      'a database error cause',
      Object.assign(new (class DatabaseError extends Error {})('duplicate key value violates unique constraint "deel_invoices_pkey"'), {
        table: 'deel_invoices',
      }),
      'Error fetching Deel receipts',
    ],
    [
      'a plain cause wrapping a database error',
      new Error('Error inserting Deel invoice record', {
        cause: new (class DatabaseError extends Error {})('relation "deel_invoices" does not exist'),
      }),
      'Error fetching Deel receipts: Error inserting Deel invoice record',
    ],
  ])('shows only the displayable part of %s', async (_, cause, expected) => {
    const injector = buildInjector(
      {
        flagForeignFeeTransactions: vi.fn().mockResolvedValue([]),
        getReferenceMergeCandidates: vi.fn().mockResolvedValue([]),
        calculateCreditcardDebitDate: vi.fn().mockResolvedValue([]),
      },
      [],
      { deelCredentials: { apiToken: 'token' } },
    );
    vi.mocked(syncDeelDocuments).mockRejectedValue(
      new Error('Error fetching Deel receipts', { cause }),
    );

    const events = await collect(runManualAutomations(injector, 'owner-1'));

    expect(events.at(-1)).toMatchObject({ state: 'FAILED', errors: [expected] });
  });

  it('still reports a merge whose accountant-review flagging failed', async () => {
    vi.mocked(degradeChargesAccountantApproval).mockRejectedValue(new Error('no permission'));
    const charges = [buildCharge('charge-a'), buildCharge('charge-b')];
    const injector = buildInjector(
      {
        flagForeignFeeTransactions: vi.fn().mockResolvedValue([]),
        getReferenceMergeCandidates: vi
          .fn()
          .mockResolvedValue([
            buildCandidate('t1', 'charge-a', { amount: '-100' }),
            buildCandidate('t2', 'charge-b', { amount: '-1', is_fee: true }),
          ]),
        calculateCreditcardDebitDate: vi.fn().mockResolvedValue([]),
      },
      charges,
    );

    const events = await collect(runManualAutomations(injector, 'owner-1'));

    // the merge is already committed, so it must show up even though the next write failed
    expect(events).toContainEqual(
      expect.objectContaining({
        __typename: 'ChargesMergedByReference',
        baseCharge: charges[0],
      }),
    );
    expect(statuses(events)).toContain('MERGE_CHARGES_BY_REFERENCE:COMPLETED_WITH_ERRORS');
    expect(
      events.find(
        event =>
          event.__typename === 'ManualAutomationStepStatus' &&
          event.step === 'MERGE_CHARGES_BY_REFERENCE' &&
          event.state === 'COMPLETED_WITH_ERRORS',
      ),
    ).toMatchObject({
      affectedCount: 1,
      errors: [
        'Merged reference "REF-1" into charge ID=charge-a, but failed to flag it for accountant review: no permission',
      ],
    });
  });

  it('keeps going when a single merge fails', async () => {
    vi.mocked(mergeChargesExecutor).mockRejectedValue(new Error('locked'));
    const injector = buildInjector(
      {
        flagForeignFeeTransactions: vi.fn().mockResolvedValue([]),
        getReferenceMergeCandidates: vi
          .fn()
          .mockResolvedValue([
            buildCandidate('t1', 'charge-a', { amount: '-100' }),
            buildCandidate('t2', 'charge-b', { amount: '-1', is_fee: true }),
          ]),
        calculateCreditcardDebitDate: vi.fn().mockResolvedValue([]),
      },
      [buildCharge('charge-a'), buildCharge('charge-b')],
    );

    const events = await collect(runManualAutomations(injector, 'owner-1'));

    expect(statuses(events)).toEqual([
      'FLAG_FOREIGN_FEES:RUNNING',
      'FLAG_FOREIGN_FEES:SUCCEEDED',
      'MERGE_CHARGES_BY_REFERENCE:RUNNING',
      'MERGE_CHARGES_BY_REFERENCE:COMPLETED_WITH_ERRORS',
      'FILL_CREDITCARD_DEBIT_DATES:RUNNING',
      'FILL_CREDITCARD_DEBIT_DATES:SUCCEEDED',
      'LINK_CREDITCARD_STATEMENTS:RUNNING',
      'LINK_CREDITCARD_STATEMENTS:SUCCEEDED',
      'FETCH_DEEL_DOCUMENTS:RUNNING',
      'FETCH_DEEL_DOCUMENTS:NOT_CONFIGURED',
    ]);
    expect(events[3]).toMatchObject({
      affectedCount: 0,
      errors: ['Failed to merge reference "REF-1" into charge ID=charge-a: locked'],
    });
  });

  it('reports item-level linking errors without failing the step', async () => {
    vi.mocked(autoLinkCreditCardStatements).mockImplementation(() =>
      linkingRun([], { errors: ['Failed to link bank transaction ID=bank-1: taken'] }),
    );
    const injector = buildInjector(
      {
        flagForeignFeeTransactions: vi.fn().mockResolvedValue([]),
        getReferenceMergeCandidates: vi.fn().mockResolvedValue([]),
        calculateCreditcardDebitDate: vi.fn().mockResolvedValue([]),
      },
      [],
    );

    const events = await collect(runManualAutomations(injector, 'owner-1'));

    expect(statuses(events)).toContain('LINK_CREDITCARD_STATEMENTS:COMPLETED_WITH_ERRORS');
    expect(statuses(events).at(-1)).toBe('FETCH_DEEL_DOCUMENTS:NOT_CONFIGURED');
  });

  it('re-flags a charge whose accounting a link changed, and reports it', async () => {
    const statement = {
      cardAccountId: 'card-1',
      currency: 'ILS',
      debitDate: '2026-03-02' as const,
      bankTransactionId: 'bank-1',
      linkMethod: 'AMOUNT' as const,
      confirmed: true,
    };
    vi.mocked(autoLinkCreditCardStatements).mockImplementation(() =>
      linkingRun([
        {
          bankTransactionId: 'bank-1',
          chargeId: 'charge-changed',
          method: 'AMOUNT',
          statements: [statement],
          changesAccounting: true,
        },
        {
          bankTransactionId: 'bank-2',
          chargeId: 'charge-unchanged',
          method: 'REFERENCE',
          statements: [{ ...statement, bankTransactionId: 'bank-2' }],
          changesAccounting: false,
        },
      ]),
    );
    const degradedCharge = buildCharge('charge-changed', { accountant_status: 'PENDING' });
    vi.mocked(degradeChargesAccountantApproval).mockResolvedValue(
      new Map([['charge-changed', degradedCharge]]),
    );
    const injector = buildInjector(
      {
        flagForeignFeeTransactions: vi.fn().mockResolvedValue([]),
        getReferenceMergeCandidates: vi.fn().mockResolvedValue([]),
        calculateCreditcardDebitDate: vi.fn().mockResolvedValue([]),
      },
      [],
    );

    const events = await collect(runManualAutomations(injector, 'owner-1'));

    expect(degradeChargesAccountantApproval).toHaveBeenCalledTimes(1);
    expect(degradeChargesAccountantApproval).toHaveBeenCalledWith(injector, ['charge-changed']);
    expect(events.filter(event => event.__typename === 'CreditcardStatementsLinked')).toEqual([
      expect.objectContaining({ bankTransaction: 'bank-1', degradedCharge }),
      expect.objectContaining({ bankTransaction: 'bank-2', degradedCharge: null }),
    ]);
    expect(statuses(events)).toContain('LINK_CREDITCARD_STATEMENTS:SUCCEEDED');
  });

  it('reports a link whose accountant-review flagging failed', async () => {
    vi.mocked(autoLinkCreditCardStatements).mockImplementation(() =>
      linkingRun([
        {
          bankTransactionId: 'bank-1',
          chargeId: 'charge-changed',
          method: 'AMOUNT',
          statements: [],
          changesAccounting: true,
        },
      ]),
    );
    vi.mocked(degradeChargesAccountantApproval).mockRejectedValue(new Error('no permission'));
    const injector = buildInjector(
      {
        flagForeignFeeTransactions: vi.fn().mockResolvedValue([]),
        getReferenceMergeCandidates: vi.fn().mockResolvedValue([]),
        calculateCreditcardDebitDate: vi.fn().mockResolvedValue([]),
      },
      [],
    );

    const events = await collect(runManualAutomations(injector, 'owner-1'));

    expect(events).toContainEqual(
      expect.objectContaining({
        step: 'LINK_CREDITCARD_STATEMENTS',
        state: 'COMPLETED_WITH_ERRORS',
        affectedCount: 1,
        errors: [
          'Linked bank transaction ID=bank-1 to its card statements, but failed to flag charge ID=charge-changed for accountant review: no permission',
        ],
      }),
    );
  });
});

describe('creditcardLinksChangeAccounting', () => {
  const LEGACY_CARD = 'card-legacy';
  const OTHER_CARD = 'card-other';

  function statementOf(cardAccountId: string) {
    return { cardAccountId, currency: 'ILS', debitDate: '2026-03-02' as const };
  }

  const ISSUER = 'business-issuer';

  function injectorFor(charge: IGetChargesByIdsResult, legacyAccountIds: string[]) {
    const providers = new Map<unknown, unknown>([
      [ChargesProvider, { getChargeByIdLoader: { load: async () => charge } }],
      [
        AdminContextProvider,
        {
          getVerifiedAdminContext: async () => ({
            financialAccounts: { internalWalletsIds: ['business-bank', ISSUER] },
          }),
        },
      ],
      [
        CreditCardStatementsProvider,
        {
          getLegacyReferenceAccountIdsByBankTransactionIdLoader: {
            load: async () => legacyAccountIds,
          },
        },
      ],
    ]);
    return { get: (token: unknown) => providers.get(token) } as unknown as Injector;
  }

  const bankRow = { id: 'bank-1', charge_id: 'charge-1' };
  const approved = buildCharge('charge-1', { accountant_status: 'APPROVED', type: null });

  function withMainBusiness(mainBusinessId: string | null) {
    vi.mocked(getChargeBusinesses).mockResolvedValue({
      allBusinessIds: mainBusinessId ? [mainBusinessId] : [],
      mainBusinessIds: mainBusinessId ? [mainBusinessId] : [],
      offsettingBusinessIds: [],
      spansSeveralSecurities: false,
      mainBusinessId,
    });
  }

  function withDocuments(invoiceCount: number, receiptCount = 0) {
    vi.mocked(getChargeDocumentsMeta).mockResolvedValue({
      invoiceCount,
      receiptCount,
    } as Awaited<ReturnType<typeof getChargeDocumentsMeta>>);
  }

  beforeEach(() => {
    vi.mocked(getChargeType).mockReset().mockResolvedValue(ChargeTypeEnum.CreditcardBankCharge);
    withMainBusiness(ISSUER);
    withDocuments(0);
  });

  it('flags an approved card debit whose main business is not an internal wallet', async () => {
    withMainBusiness('business-supplier');

    await expect(
      creditcardLinksChangeAccounting(injectorFor(approved, [LEGACY_CARD]), bankRow, [
        statementOf(LEGACY_CARD),
      ]),
    ).resolves.toBe(true);
  });

  it('flags an approved card debit without a main business', async () => {
    withMainBusiness(null);

    await expect(
      creditcardLinksChangeAccounting(injectorFor(approved, [LEGACY_CARD]), bankRow, [
        statementOf(LEGACY_CARD),
      ]),
    ).resolves.toBe(true);
  });

  it('flags an approved card debit booked from its documents', async () => {
    withDocuments(0, 1);

    await expect(
      creditcardLinksChangeAccounting(injectorFor(approved, [LEGACY_CARD]), bankRow, [
        statementOf(LEGACY_CARD),
      ]),
    ).resolves.toBe(true);
  });

  it('keeps an approved card debit linked to the account its reference resolved to', async () => {
    await expect(
      creditcardLinksChangeAccounting(injectorFor(approved, [LEGACY_CARD]), bankRow, [
        statementOf(LEGACY_CARD),
      ]),
    ).resolves.toBe(false);
  });

  it('flags an approved charge that becomes a card debit with the link', async () => {
    vi.mocked(getChargeType).mockResolvedValue(ChargeTypeEnum.Common);

    await expect(
      creditcardLinksChangeAccounting(injectorFor(approved, [LEGACY_CARD]), bankRow, [
        statementOf(LEGACY_CARD),
      ]),
    ).resolves.toBe(true);
  });

  it('flags an approved card debit linked to another card account', async () => {
    await expect(
      creditcardLinksChangeAccounting(injectorFor(approved, [LEGACY_CARD]), bankRow, [
        statementOf(OTHER_CARD),
      ]),
    ).resolves.toBe(true);
  });

  it('flags an approved card debit linked to several card accounts', async () => {
    await expect(
      creditcardLinksChangeAccounting(injectorFor(approved, [LEGACY_CARD]), bankRow, [
        statementOf(LEGACY_CARD),
        statementOf(OTHER_CARD),
      ]),
    ).resolves.toBe(true);
  });

  it('flags an approved card debit whose reference resolved to no account', async () => {
    await expect(
      creditcardLinksChangeAccounting(injectorFor(approved, []), bankRow, [
        statementOf(LEGACY_CARD),
      ]),
    ).resolves.toBe(true);
  });

  it('leaves charges that are not approved alone', async () => {
    const pending = buildCharge('charge-1', { accountant_status: 'PENDING', type: null });
    vi.mocked(getChargeType).mockResolvedValue(ChargeTypeEnum.Common);

    await expect(
      creditcardLinksChangeAccounting(injectorFor(pending, []), bankRow, [statementOf(OTHER_CARD)]),
    ).resolves.toBe(false);
    expect(getChargeType).not.toHaveBeenCalled();
  });
});
