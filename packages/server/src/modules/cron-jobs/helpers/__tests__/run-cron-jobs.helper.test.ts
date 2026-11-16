import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { mergeChargesExecutor } from '../../../charges/helpers/merge-charges.helper.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../../charges/types.js';
import { syncDeelDocuments } from '../../../deel/helpers/sync-deel-documents.helper.js';
import { ProviderCredentialsProvider } from '../../../provider-credentials/providers/provider-credentials.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import { CronJobsProvider } from '../../providers/cron-jobs.provider.js';
import type { IGetReferenceMergeCandidatesResult } from '../../types.js';
import {
  buildMergedChargeSnapshots,
  runCronJobs,
  type CronJobEventProto,
} from '../run-cron-jobs.helper.js';

vi.mock('../../../charges/helpers/merge-charges.helper.js', () => ({
  mergeChargesExecutor: vi.fn(),
}));
vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));
vi.mock('../../../deel/helpers/sync-deel-documents.helper.js', () => ({
  syncDeelDocuments: vi.fn(),
}));

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

type CronJobsProviderMock = {
  flagForeignFeeTransactions: ReturnType<typeof vi.fn>;
  getReferenceMergeCandidates: ReturnType<typeof vi.fn>;
  calculateCreditcardDebitDate: ReturnType<typeof vi.fn>;
};

function buildInjector(
  cronJobsProvider: CronJobsProviderMock,
  charges: IGetChargesByIdsResult[],
  { deelCredentials = null }: { deelCredentials?: { apiToken: string } | null } = {},
) {
  const providers = new Map<unknown, unknown>([
    [ProviderCredentialsProvider, { getDeelCredentials: async () => deelCredentials }],
    [CronJobsProvider, cronJobsProvider],
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

async function collect(events: AsyncIterable<CronJobEventProto>) {
  const result: CronJobEventProto[] = [];
  for await (const event of events) {
    result.push(event);
  }
  return result;
}

function statuses(events: CronJobEventProto[]) {
  return events
    .filter(event => event.__typename === 'CronJobStepStatus')
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

describe('runCronJobs', () => {
  beforeEach(() => {
    vi.mocked(mergeChargesExecutor).mockReset().mockResolvedValue(undefined);
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
    vi.mocked(syncDeelDocuments).mockReset().mockResolvedValue({ charges: [] });
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

    const events = await collect(runCronJobs(injector, 'owner-1'));

    expect(statuses(events)).toEqual([
      'FLAG_FOREIGN_FEES:RUNNING',
      'FLAG_FOREIGN_FEES:SUCCEEDED',
      'MERGE_CHARGES_BY_REFERENCE:RUNNING',
      'MERGE_CHARGES_BY_REFERENCE:SUCCEEDED',
      'FILL_CREDITCARD_DEBIT_DATES:RUNNING',
      'FILL_CREDITCARD_DEBIT_DATES:SUCCEEDED',
      'FETCH_DEEL_DOCUMENTS:RUNNING',
      'FETCH_DEEL_DOCUMENTS:SUCCEEDED',
    ]);
    expect(events.filter(event => event.__typename !== 'CronJobStepStatus')).toEqual([
      { __typename: 'ForeignFeeTransactionFlagged', transaction: 'fee-1' },
      { __typename: 'ForeignFeeTransactionFlagged', transaction: 'fee-2' },
      {
        __typename: 'ChargesMergedByReference',
        reference: 'REF-1',
        baseCharge: charges[0],
        mergedCharges: [expect.objectContaining({ id: 'charge-b', date: '2026-01-10' })],
      },
      { __typename: 'CreditcardDebitDateFilled', transaction: 'cc-1', debitDate: '2026-03-02' },
      { __typename: 'DeelChargeSynced', charge: deelCharge, isNew: true, invoiceCount: 2 },
    ]);
    expect(mergeChargesExecutor).toHaveBeenCalledWith(['charge-b'], 'charge-a', injector);
    expect(syncDeelDocuments).toHaveBeenCalledWith(injector);
    // debit dates step status, then the Deel step's RUNNING, synced charge and SUCCEEDED
    expect(events.at(-4)).toMatchObject({ affectedCount: 1, errors: null });
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

    const events = await collect(runCronJobs(injector, 'owner-1'));

    expect(statuses(events)).toEqual([
      'FLAG_FOREIGN_FEES:RUNNING',
      'FLAG_FOREIGN_FEES:FAILED',
      'MERGE_CHARGES_BY_REFERENCE:SKIPPED',
      'FILL_CREDITCARD_DEBIT_DATES:SKIPPED',
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

    const events = await collect(runCronJobs(injector, 'owner-1'));

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

    const events = await collect(runCronJobs(injector, 'owner-1'));

    expect(statuses(events)).toEqual([
      'FLAG_FOREIGN_FEES:RUNNING',
      'FLAG_FOREIGN_FEES:SUCCEEDED',
      'MERGE_CHARGES_BY_REFERENCE:RUNNING',
      'MERGE_CHARGES_BY_REFERENCE:SUCCEEDED',
      'FILL_CREDITCARD_DEBIT_DATES:RUNNING',
      'FILL_CREDITCARD_DEBIT_DATES:SUCCEEDED',
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

    const events = await collect(runCronJobs(injector, 'owner-1'));

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

    const events = await collect(runCronJobs(injector, 'owner-1'));

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
          event.__typename === 'CronJobStepStatus' &&
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

    const events = await collect(runCronJobs(injector, 'owner-1'));

    expect(statuses(events)).toEqual([
      'FLAG_FOREIGN_FEES:RUNNING',
      'FLAG_FOREIGN_FEES:SUCCEEDED',
      'MERGE_CHARGES_BY_REFERENCE:RUNNING',
      'MERGE_CHARGES_BY_REFERENCE:COMPLETED_WITH_ERRORS',
      'FILL_CREDITCARD_DEBIT_DATES:RUNNING',
      'FILL_CREDITCARD_DEBIT_DATES:SUCCEEDED',
      'FETCH_DEEL_DOCUMENTS:RUNNING',
      'FETCH_DEEL_DOCUMENTS:NOT_CONFIGURED',
    ]);
    expect(events[3]).toMatchObject({
      affectedCount: 0,
      errors: ['Failed to merge reference "REF-1" into charge ID=charge-a: locked'],
    });
  });
});
