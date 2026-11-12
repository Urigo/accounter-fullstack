import type { GraphQLResolveInfo } from 'graphql';
import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_UUID } from '../../../../shared/constants.js';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../../charges/types.js';
import { ledgerGenerationByCharge } from '../../helpers/ledger-by-charge-type.helper.js';
import {
  ledgerRecordsGenerationFullMatchComparison,
  ledgerRecordsGenerationPartialMatchComparison,
} from '../../helpers/ledgrer-storage.helper.js';
import { LedgerProvider } from '../../providers/ledger.provider.js';
import type { IGetLedgerRecordsByChargesIdsResult } from '../../types.js';
import { ledgerResolvers } from '../ledger.resolver.js';

/**
 * `Mutation.regenerateLedgerRecords` responds with the charge's ledger as stored after regenerating.
 *
 * It used to respond with only the records it changed, and the newly inserted ones still carried the
 * EMPTY_UUID placeholder id. The client takes the ledger's new state from the mutation payload
 * (#4481), so that payload has to be the charge's full, real ledger.
 */

vi.mock('../../helpers/ledger-by-charge-type.helper.js', () => ({
  ledgerGenerationByCharge: vi.fn(),
  ledgerUnbalancedBusinessesByCharge: vi.fn(),
}));

vi.mock('../../helpers/ledger-lock.js', () => ({
  isChargeLocked: vi.fn(async () => false),
}));

vi.mock('../../helpers/ledgrer-storage.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../helpers/ledgrer-storage.helper.js')>()),
  ledgerRecordsGenerationFullMatchComparison: vi.fn(),
  ledgerRecordsGenerationPartialMatchComparison: vi.fn(),
  convertLedgerRecordToInput: vi.fn((record: unknown) => record),
}));

vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));

const CHARGE_ID = 'cc000000-0000-4000-8000-000000000001';
const KEPT_ID = 'dd000000-0000-4000-8000-000000000001';
const INSERTED_ID = 'dd000000-0000-4000-8000-000000000002';

const charge = { id: CHARGE_ID } as IGetChargesByIdsResult;
const record = (id: string, invoice_date: string) =>
  ({ id, charge_id: CHARGE_ID, invoice_date }) as unknown as IGetLedgerRecordsByChargesIdsResult;

const keptRecord = record(KEPT_ID, '2026-01-01');
const insertedRecord = record(INSERTED_ID, '2026-02-01');
const generatedNewRecord = record(EMPTY_UUID, '2026-02-01');

function context() {
  // Mirrors the real loader: it serves what is stored, and the insert stores the new record.
  let stored = [keptRecord];
  const getLedgerRecordsByChargesIdLoader = {
    load: vi.fn(async () => [...stored]),
    clear: vi.fn(() => getLedgerRecordsByChargesIdLoader),
  };
  const ledgerProvider = {
    getLedgerRecordsByChargesIdLoader,
    deleteLedgerRecordsByIdLoader: { loadMany: vi.fn(async () => []), load: vi.fn() },
    insertLedgerRecords: vi.fn(async () => {
      stored = [keptRecord, insertedRecord];
      return [];
    }),
  };
  const providers = new Map<unknown, unknown>([
    [LedgerProvider, ledgerProvider],
    [ChargesProvider, { getChargeByIdLoader: { load: vi.fn(async () => charge) } }],
    [
      AdminContextProvider,
      { getVerifiedAdminContext: vi.fn(async () => ({ ledgerLock: null, ownerId: 'owner' })) },
    ],
  ]);
  const injector = {
    get: (token: unknown) => {
      if (!providers.has(token)) {
        throw new Error('unexpected provider requested');
      }
      return providers.get(token);
    },
  } as unknown as Injector;
  return { injector } as never;
}

const regenerateLedgerRecords = ledgerResolvers.Mutation!.regenerateLedgerRecords as unknown as (
  parent: unknown,
  args: { chargeIds: string[] },
  context: unknown,
  info: GraphQLResolveInfo,
) => Promise<Array<{ records: IGetLedgerRecordsByChargesIdsResult[]; charge: unknown }>>;

describe('Mutation.regenerateLedgerRecords', () => {
  beforeEach(() => {
    vi.mocked(ledgerGenerationByCharge).mockResolvedValue({
      records: [keptRecord, generatedNewRecord],
      errors: [],
    } as never);
    vi.mocked(ledgerRecordsGenerationFullMatchComparison).mockReturnValue({
      unmatchedStorageRecords: [],
      unmatchedNewRecords: [generatedNewRecord],
      fullMatches: new Map(),
      isFullyMatched: false,
    });
    vi.mocked(ledgerRecordsGenerationPartialMatchComparison).mockReturnValue({
      toUpdate: [generatedNewRecord],
      toRemove: [],
    });
    vi.mocked(degradeChargesAccountantApproval).mockResolvedValue(new Map());
  });

  it("responds with the charge's stored ledger, not just the changed records", async () => {
    const [result] = await regenerateLedgerRecords(
      null,
      { chargeIds: [CHARGE_ID] },
      context(),
      {} as GraphQLResolveInfo,
    );

    expect(result.records.map(({ id }) => id)).toEqual([INSERTED_ID, KEPT_ID]);
    expect(result.records.map(({ id }) => id)).not.toContain(EMPTY_UUID);
    expect(result.charge).toBe(charge);
  });
});
