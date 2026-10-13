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
import type { IGetChargesByIdsResult } from '../../charges/types.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';
import { MiscExpensesProvider } from '../../misc-expenses/providers/misc-expenses.provider.js';
import { LedgerProvider } from '../providers/ledger.provider.js';
import { isChargeLocked } from './ledger-lock.js';
import { validateLedgerRecordParams } from './ledger-validation.helper.js';
import {
  deriveDocumentFromLedgerInput,
  deriveMiscExpenseFromLedgerInput,
  ledgerRecordInputToParams,
  validateManualLedgerRecord,
  type ManualLedgerRecordDocument,
  type ManualLedgerRecordParams,
} from './manual-ledger-record.helper.js';

type CommonError = { __typename: 'CommonError'; message: string };

/**
 * Re-flag a charge for accountant review as part of a manual ledger write, and return the charge in
 * its fresh state: the degraded charge, else the already-loaded `charge`, else a reload. Call it
 * inside the write's transaction, so a failure here rolls the write back instead of reporting an
 * error for rows that were in fact saved.
 */
async function degradeAndLoadCharge(
  injector: Injector,
  chargeId: string,
  charge?: IGetChargesByIdsResult,
): Promise<IGetChargesByIdsResult> {
  const degradedCharges = await degradeChargesAccountantApproval(injector, [chargeId]);
  const freshCharge =
    degradedCharges.get(chargeId) ??
    charge ??
    (await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId));
  if (!freshCharge) {
    throw new Error(`Charge with id ${chargeId} not found`);
  }
  return freshCharge;
}

/**
 * Row-level security only lets a request write rows of its write-target business (the admin
 * context's owner), even when it reads several businesses; the admin context it validates against
 * (local currency, ledger lock) is that business's too. Rejects a charge or record of any other
 * business up front with an actionable message instead of a generic RLS failure.
 */
function writeTargetMismatchError(
  subject: 'charge' | 'ledger record',
  ownerId: string,
  writeTargetOwnerId: string,
): CommonError | null {
  if (ownerId === writeTargetOwnerId) {
    return null;
  }
  return {
    __typename: 'CommonError',
    message: `This ${subject} belongs to business ${ownerId}, but this request can only write to business ${writeTargetOwnerId}. Narrow the business scope to the ${subject}'s business and try again.`,
  };
}

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
 * Look up the types of the main debit and credit entities, then derive the document a DOCUMENT
 * ledger record represents. A missing entity or a derivation problem is returned as a
 * `CommonError`.
 */
async function deriveDocument(
  injector: Injector,
  input: LedgerRecordInput,
  ctx: Omit<Parameters<typeof deriveDocumentFromLedgerInput>[1], 'entityTypes'>,
): Promise<{ document: ManualLedgerRecordDocument } | { error: CommonError }> {
  const entityIds = [input.debitEntity1, input.creditEntity1];
  const entities = await injector
    .get(FinancialEntitiesProvider)
    .getFinancialEntityByIdLoader.loadMany(entityIds);
  const entityTypes = new Map<string, string>();
  for (const [index, entity] of entities.entries()) {
    if (!entity || entity instanceof Error) {
      return {
        error: {
          __typename: 'CommonError',
          message: `Financial entity with id ${entityIds[index]} not found`,
        },
      };
    }
    if (entity.type) {
      entityTypes.set(entity.id, entity.type);
    }
  }

  try {
    return { document: deriveDocumentFromLedgerInput(input, { ...ctx, entityTypes }) };
  } catch (e) {
    return {
      error: { __typename: 'CommonError', message: e instanceof Error ? e.message : String(e) },
    };
  }
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

    const {
      ownerId: writeTargetOwnerId,
      defaultLocalCurrency,
      ledgerLock,
    } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
    const ownerError = writeTargetMismatchError(
      'ledger record',
      record.owner_id,
      writeTargetOwnerId,
    );
    if (ownerError) {
      return ownerError;
    }

    const checked = checkManualLedgerRecord(
      input,
      { chargeId: record.charge_id, ownerId: record.owner_id },
      { localCurrency: defaultLocalCurrency, ledgerLock },
    );
    if ('error' in checked) {
      return checked.error;
    }
    const { params } = checked;

    // The update and the charge's re-flagging land together, or not at all
    const result = await injector.get(TenantAwareDBClient).transaction(async () => {
      // Match the record's own owner (checked above to be the write target)
      const [updatedRecord] = await ledgerProvider.updateLedgerRecord({
        ...params,
        ledgerId: record.id,
        ownerId: record.owner_id,
      });
      if (!updatedRecord) {
        return null;
      }
      const charge = await degradeAndLoadCharge(injector, record.charge_id);
      return { record: updatedRecord, charge };
    });
    if (!result) {
      return {
        __typename: 'CommonError',
        message: `Ledger record with id ${ledgerRecordId} was not updated: it may have been locked or removed`,
      };
    }

    return result;
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
 * entity the chosen operation says it represents (a misc expense for MISC_EXPENSE, an INVOICE document for DOCUMENT). Both rows are
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

    const {
      ownerId: writeTargetOwnerId,
      defaultLocalCurrency,
      ledgerLock,
      authorities,
    } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
    const ownerError = writeTargetMismatchError('charge', charge.owner_id, writeTargetOwnerId);
    if (ownerError) {
      return ownerError;
    }

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
      case 'DOCUMENT': {
        const derived = await deriveDocument(injector, input, {
          ownerId,
          localCurrency: defaultLocalCurrency,
          inputVatTaxCategoryId: authorities.inputVatTaxCategoryId,
          outputVatTaxCategoryId: authorities.outputVatTaxCategoryId,
        });
        if ('error' in derived) {
          return derived.error;
        }
        const { document } = derived;
        insertEntity = async () => {
          const [insertedDocument] = await injector
            .get(DocumentsProvider)
            .insertDocuments({ documents: [{ ...document, chargeId, ownerId }] });
          if (!insertedDocument) {
            throw new Error('Document was not inserted');
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
    // transaction's connection; throwing inside the callback rolls every write back, including the
    // charge's re-flagging
    return await injector.get(TenantAwareDBClient).transaction(async () => {
      await insertEntity();
      const [ledgerRecord] = await injector.get(LedgerProvider).insertLedgerRecords({
        ledgerRecords: [{ ...params, chargeId, ownerId }],
      });
      if (!ledgerRecord) {
        throw new Error('Ledger record was not inserted');
      }
      return {
        record: ledgerRecord,
        charge: await degradeAndLoadCharge(injector, chargeId, charge),
      };
    });
  } catch (e) {
    console.error(`Failed to insert ledger record for charge ID="${chargeId}"`, e);
    return {
      __typename: 'CommonError',
      message: `Failed to insert ledger record for charge ID="${chargeId}"`,
    };
  }
}
