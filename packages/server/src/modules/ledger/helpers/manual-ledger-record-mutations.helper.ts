import { type Injector } from 'graphql-modules';
import type {
  LedgerRecordInput,
  LedgerRecordOperation,
  ResolversTypes,
} from '../../../__generated__/types.js';
import type { Currency } from '../../../shared/enums.js';
import { LedgerLockError } from '../../../shared/errors.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { MiscExpensesProvider } from '../../misc-expenses/providers/misc-expenses.provider.js';
import { LedgerProvider } from '../providers/ledger.provider.js';
import { isChargeLocked } from './ledger-lock.js';
import { validateLedgerRecordParams } from './ledger-validation.helper.js';
import {
  deriveMiscExpenseFromLedgerInput,
  ledgerRecordInputToParams,
  validateManualLedgerRecord,
  type ManualLedgerRecordParams,
} from './manual-ledger-record.helper.js';

type CommonError = { __typename: 'CommonError'; message: string };

/**
 * Validate a manual ledger record against the form rules, then against the ledger provider's own
 * invariants (which run after the friendlier checks). Returns the record's column params, or a
 * `CommonError` listing every problem.
 */
function checkManualLedgerRecord(
  input: LedgerRecordInput,
  { chargeId, ownerId }: { chargeId: string; ownerId: string },
  ctx: { localCurrency: Currency; ledgerLock?: TimelessDateString | null },
): { params: ManualLedgerRecordParams } | { error: CommonError } {
  const validationErrors = validateManualLedgerRecord(input, ctx);
  if (validationErrors.length > 0) {
    return { error: { __typename: 'CommonError', message: validationErrors.join('\n') } };
  }

  const params = ledgerRecordInputToParams(input);
  try {
    validateLedgerRecordParams({ ...params, chargeId, ownerId }, ctx.localCurrency);
  } catch (e) {
    return {
      error: { __typename: 'CommonError', message: e instanceof Error ? e.message : String(e) },
    };
  }
  return { params };
}

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
    const checked = checkManualLedgerRecord(
      input,
      { chargeId: record.charge_id, ownerId: record.owner_id },
      { localCurrency: defaultLocalCurrency, ledgerLock },
    );
    if ('error' in checked) {
      return checked.error;
    }
    const { params } = checked;

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

/**
 * Insert a manual ledger record under a charge, stored exactly as typed, together with the business
 * entity the chosen operation says it represents (a misc expense for MISC_EXPENSE). Both rows are
 * written in one DB transaction, so either both land or neither does. Every failure (missing or
 * locked charge, invalid input, a storage error) is returned as a `CommonError` rather than thrown.
 */
export async function insertManualLedgerRecord(
  injector: Injector,
  {
    chargeId,
    operation,
    input,
  }: { chargeId: string; operation: LedgerRecordOperation; input: LedgerRecordInput },
): Promise<ResolversTypes['InsertLedgerRecordResult']> {
  try {
    const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
    if (!charge) {
      return {
        __typename: 'CommonError',
        message: `Charge with id ${chargeId} not found`,
      };
    }

    const { defaultLocalCurrency, ledgerLock } = await injector
      .get(AdminContextProvider)
      .getVerifiedAdminContext();
    if (await isChargeLocked(charge, injector, ledgerLock)) {
      return {
        __typename: 'CommonError',
        message: "The charge's ledger is locked",
      };
    }

    const ownerId = charge.owner_id;
    const checked = checkManualLedgerRecord(
      input,
      { chargeId, ownerId },
      { localCurrency: defaultLocalCurrency, ledgerLock },
    );
    if ('error' in checked) {
      return checked.error;
    }
    const { params } = checked;

    // Derive the backing entity before opening the transaction, so it only holds the writes
    let insertEntity: () => Promise<void>;
    switch (operation) {
      case 'MISC_EXPENSE': {
        const miscExpense = deriveMiscExpenseFromLedgerInput(input, {
          localCurrency: defaultLocalCurrency,
        });
        insertEntity = async () => {
          const [expense] = await injector
            .get(MiscExpensesProvider)
            .insertExpense({ ...miscExpense, chargeId, ownerId });
          if (!expense) {
            throw new Error('Misc expense was not inserted');
          }
        };
        break;
      }
      default: {
        const unknownOperation: never = operation;
        return {
          __typename: 'CommonError',
          message: `Unsupported ledger record operation: ${String(unknownOperation)}`,
        };
      }
    }

    // The providers share the request's TenantAwareDBClient, so their queries run on this
    // transaction's connection; throwing inside the callback rolls both inserts back
    const record = await injector.get(TenantAwareDBClient).transaction(async () => {
      await insertEntity();
      const [ledgerRecord] = await injector.get(LedgerProvider).insertLedgerRecords({
        ledgerRecords: [{ ...params, chargeId, ownerId }],
      });
      if (!ledgerRecord) {
        throw new Error('Ledger record was not inserted');
      }
      return ledgerRecord;
    });

    const degradedCharges = await degradeChargesAccountantApproval(injector, [chargeId]);
    return { record, charge: degradedCharges.get(chargeId) ?? charge };
  } catch (e) {
    console.error(`Failed to insert ledger record for charge ID="${chargeId}"`, e);
    return {
      __typename: 'CommonError',
      message: `Failed to insert ledger record for charge ID="${chargeId}"`,
    };
  }
}
