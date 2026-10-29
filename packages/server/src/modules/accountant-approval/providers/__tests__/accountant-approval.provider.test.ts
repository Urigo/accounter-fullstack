import DataLoader from 'dataloader';
import { describe, expect, it, vi } from 'vitest';
import type { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { ChargesAuthorizationProvider } from '../../../charges/providers/charges-authorization.provider.js';
import type { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../../charges/types.js';
import { AccountantApprovalProvider } from '../accountant-approval.provider.js';

/**
 * Degrading a charge's approval must leave the charge loader serving the degraded row.
 *
 * Callers usually load the charge before degrading it (`insertMiscExpense`, `updateDocument` moving
 * a document into an existing charge). DataLoader's `prime` is a no-op for a key already in the
 * cache, so priming alone kept serving the pre-degrade APPROVED row to the rest of the operation -
 * including the mutation payload the client patches its charge from (#4481).
 */

const CHARGE_ID = 'cc000000-0000-4000-8000-000000000001';

const charge = (accountant_status: IGetChargesByIdsResult['accountant_status']) =>
  ({ id: CHARGE_ID, accountant_status }) as IGetChargesByIdsResult;

function setup() {
  const approved = charge('APPROVED');
  const pending = charge('PENDING');
  const getChargeByIdLoader = new DataLoader(async (ids: readonly string[]) =>
    ids.map(() => approved),
  );
  // pgtyped's `run` calls `query(text, values)` and maps `rows`; this is the degrade UPDATE's RETURNING
  const db = { query: vi.fn(async () => ({ rows: [pending] })) };
  const provider = new AccountantApprovalProvider(
    db as unknown as TenantAwareDBClient,
    { canWriteCharge: vi.fn(async () => undefined) } as unknown as ChargesAuthorizationProvider,
    { getChargeByIdLoader } as unknown as ChargesProvider,
  );
  return { provider, getChargeByIdLoader, db };
}

describe('AccountantApprovalProvider.degradeChargeAccountantApproval', () => {
  it('replaces a charge already in the loader cache with the degraded row', async () => {
    const { provider, getChargeByIdLoader } = setup();

    expect((await getChargeByIdLoader.load(CHARGE_ID))?.accountant_status).toBe('APPROVED');

    const degraded = await provider.degradeChargeAccountantApproval(CHARGE_ID);

    expect(degraded?.accountant_status).toBe('PENDING');
    expect((await getChargeByIdLoader.load(CHARGE_ID))?.accountant_status).toBe('PENDING');
  });

  it('leaves the cache alone when the charge was not approved', async () => {
    const { provider, getChargeByIdLoader, db } = setup();
    db.query.mockResolvedValueOnce({ rows: [] });

    await getChargeByIdLoader.load(CHARGE_ID);
    const degraded = await provider.degradeChargeAccountantApproval(CHARGE_ID);

    expect(degraded).toBeUndefined();
    expect((await getChargeByIdLoader.load(CHARGE_ID))?.accountant_status).toBe('APPROVED');
  });
});
