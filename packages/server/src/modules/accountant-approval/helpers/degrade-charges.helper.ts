import { type Injector } from 'graphql-modules';
import { EMPTY_UUID } from '../../../shared/constants.js';
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
 */
export async function degradeChargesAccountantApproval(
  injector: Injector,
  chargeIds: ReadonlyArray<string | null | undefined>,
): Promise<void> {
  const uniqueChargeIds = [
    ...new Set(
      chargeIds.filter(
        (id): id is string => typeof id === 'string' && id.length > 0 && id !== EMPTY_UUID,
      ),
    ),
  ];
  if (uniqueChargeIds.length === 0) {
    return;
  }

  const provider = injector.get(AccountantApprovalProvider);
  await Promise.all(
    uniqueChargeIds.map(chargeId => provider.degradeChargeAccountantApproval(chargeId)),
  );
}
