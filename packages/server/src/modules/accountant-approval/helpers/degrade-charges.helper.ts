import { type Injector } from 'graphql-modules';
import { EMPTY_UUID } from '../../../shared/constants.js';
import type { IGetChargesByIdsResult } from '../../charges/types.js';
import { AccountantApprovalProvider } from '../providers/accountant-approval.provider.js';

/**
 * Degrade the accountant approval status (APPROVED -> PENDING) for each of the
 * given charges, so a charge whose underlying data changed gets re-flagged for
 * accountant review. Charges in any other status (PENDING / UNAPPROVED) are left
 * untouched.
 *
 * The list is de-duplicated and empty / EMPTY_UUID ids are ignored. It is safe
 * to pass newly-generated charge ids: they are never APPROVED, so degrading them
 * is a no-op.
 *
 * Returns a map (keyed by charge id) of the charges that were actually degraded,
 * carrying their fresh (PENDING) state so callers can return an up-to-date charge
 * in their response instead of a stale one.
 */
export async function degradeChargesAccountantApproval(
  injector: Injector,
  chargeIds: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, IGetChargesByIdsResult>> {
  const degradedCharges = new Map<string, IGetChargesByIdsResult>();

  const uniqueChargeIds = [
    ...new Set(
      chargeIds.filter(
        (id): id is string => typeof id === 'string' && id.length > 0 && id !== EMPTY_UUID,
      ),
    ),
  ];
  if (uniqueChargeIds.length === 0) {
    return degradedCharges;
  }

  const provider = injector.get(AccountantApprovalProvider);
  await Promise.all(
    uniqueChargeIds.map(async chargeId => {
      const degradedCharge = await provider.degradeChargeAccountantApproval(chargeId);
      if (degradedCharge) {
        degradedCharges.set(degradedCharge.id, degradedCharge);
      }
    }),
  );

  return degradedCharges;
}
