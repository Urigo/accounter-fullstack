import { type Injector } from 'graphql-modules';
import type { LedgerRecordInput, ResolversTypes } from '../../../__generated__/types.js';
import { LedgerLockError } from '../../../shared/errors.js';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { LedgerProvider } from '../providers/ledger.provider.js';
import { validateLedgerRecordParams } from './ledger-validation.helper.js';
import {
  ledgerRecordInputToParams,
  validateManualLedgerRecord,
} from './manual-ledger-record.helper.js';

/**
 * Overwrite the content of a single stored, unlocked ledger record. Every failure (missing or
 * locked record, invalid input, a storage error) is returned as a `CommonError` rather than thrown.
 */
export async function updateManualLedgerRecord(
  injector: Injector,
  { ledgerRecordId, input }: { ledgerRecordId: string; input: LedgerRecordInput },
): Promise<ResolversTypes['UpdateLedgerRecordResult']> {
  try {
    const ledgerProvider = injector.get(LedgerProvider);
    const record = await ledgerProvider.getLedgerRecordsByIdLoader.load(ledgerRecordId);
    if (!record) {
      return {
        __typename: 'CommonError',
        message: `Ledger record with id ${ledgerRecordId} not found`,
      };
    }
    if (record.locked) {
      return {
        __typename: 'CommonError',
        message: new LedgerLockError().message,
      };
    }

    const { defaultLocalCurrency, ledgerLock } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    const validationErrors = validateManualLedgerRecord(input, {
      localCurrency: defaultLocalCurrency,
      ledgerLock,
    });
    if (validationErrors.length > 0) {
      return {
        __typename: 'CommonError',
        message: validationErrors.join('\n'),
      };
    }

    // Guards the provider's own invariants; runs after the friendlier checks above
    const params = ledgerRecordInputToParams(input);
    try {
      validateLedgerRecordParams(
        { ...params, chargeId: record.charge_id, ownerId: record.owner_id },
        defaultLocalCurrency,
      );
    } catch (e) {
      return {
        __typename: 'CommonError',
        message: e instanceof Error ? e.message : String(e),
      };
    }

    // Match the record's own owner, so a record of another business the user manages is updated
    const [updatedRecord] = await ledgerProvider.updateLedgerRecord({
      ...params,
      ledgerId: record.id,
      ownerId: record.owner_id,
    });
    if (!updatedRecord) {
      return {
        __typename: 'CommonError',
        message: `Ledger record with id ${ledgerRecordId} was not updated: it may have been locked or removed`,
      };
    }

    const chargeId = record.charge_id;
    const degradedCharges = await degradeChargesAccountantApproval(injector, [chargeId]);
    const charge =
      degradedCharges.get(chargeId) ??
      (await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId));
    if (!charge) {
      return {
        __typename: 'CommonError',
        message: `Charge with id ${chargeId} not found`,
      };
    }

    return { record: updatedRecord, charge };
  } catch (e) {
    console.error(`Failed to update ledger record ID="${ledgerRecordId}"`, e);
    return {
      __typename: 'CommonError',
      message: `Failed to update ledger record ID="${ledgerRecordId}"`,
    };
  }
}
