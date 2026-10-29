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
  deriveNewChargeFromLedgerInput,
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
  { chargeId, ownerId }: { chargeId?: string; ownerId: string },
  ctx: { localCurrency: Currency; ledgerLock?: TimelessDateString | null },
): { params: ManualLedgerRecordParams } | { error: CommonError } {
  const validationErrors = validateManualLedgerRecord(input, ctx);
  if (validationErrors.length > 0) {
    return { error: { __typename: 'CommonError', message: validationErrors.join('\n') } };
  }

  const params = ledgerRecordInputToParams(input);
  try {
    // The provider check reads only the record's content; the charge ID is there to fill its param
    // shape, so a record whose charge is not created yet passes an empty one
    validateLedgerRecordParams({ ...params, chargeId: chargeId ?? '', ownerId }, ctx.localCurrency);
  } catch (e) {
    return {
      error: { __typename: 'CommonError', message: e instanceof Error ? e.message : String(e) },
    };
  }
  return { params };
}

/**
 * Load every financial entity the record references and require each to belong to `ownerId`, the
 * request's write target. Reads span the whole business scope, but RLS does not check the entity
 * columns of a written row, so without this a record could point at another business's entities.
 * Mirrors `validateSecuritiesContextPatch`: an entity of another business counts as not found.
 * Returns the entities' types (for deriving a document), or a `CommonError`.
 */
async function loadOwnedEntityTypes(
  injector: Injector,
  input: LedgerRecordInput,
  ownerId: string,
): Promise<{ entityTypes: Map<string, string> } | { error: CommonError }> {
  const entityIds = [
    ...new Set(
      [input.debitEntity1, input.creditEntity1, input.debitEntity2, input.creditEntity2].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
  const entities = await injector
    .get(FinancialEntitiesProvider)
    .getFinancialEntityByIdLoader.loadMany(entityIds);
  const entityTypes = new Map<string, string>();
  const unknownIds: string[] = [];
  for (const [index, entityId] of entityIds.entries()) {
    const entity = entities[index];
    if (entity instanceof Error) {
      console.error(`Failed to load financial entity ID="${entityId}"`, entity);
    }
    if (!entity || entity instanceof Error || entity.owner_id !== ownerId) {
      unknownIds.push(entityId);
      continue;
    }
    if (entity.type) {
      entityTypes.set(entity.id, entity.type);
    }
  }
  if (unknownIds.length > 0) {
    return {
      error: {
        __typename: 'CommonError',
        message: unknownIds
          .map(id => `Financial entity with id ${id} not found in this business`)
          .join('\n'),
      },
    };
  }
  return { entityTypes };
}

/**
 * Derive the document a DOCUMENT ledger record represents. A derivation problem is returned as a
 * `CommonError`.
 */
function deriveDocument(
  input: LedgerRecordInput,
  ctx: Parameters<typeof deriveDocumentFromLedgerInput>[1],
): { document: ManualLedgerRecordDocument } | { error: CommonError } {
  try {
    return { document: deriveDocumentFromLedgerInput(input, ctx) };
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
    const owned = await loadOwnedEntityTypes(injector, input, record.owner_id);
    if ('error' in owned) {
      return owned.error;
    }

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
 * entity the chosen operation says it represents: a misc expense for MISC_EXPENSE, an INVOICE
 * document for DOCUMENT. Without a `chargeId`, a new charge of the request's write-target business
 * is created for them. All rows are written in one DB transaction, so either all land or none does.
 * Every failure (missing or locked charge, invalid input, a storage error) is returned as a
 * `CommonError` rather than thrown.
 */
export async function insertManualLedgerRecord(
  injector: Injector,
  {
    chargeId,
    operation,
    input,
  }: { chargeId?: string | null; operation: LedgerRecordOperation; input: LedgerRecordInput },
): Promise<ResolversTypes['InsertLedgerRecordResult']> {
  const chargeLabel = chargeId ? `for charge ID="${chargeId}"` : 'with a new charge';
  try {
    let charge: IGetChargesByIdsResult | undefined;
    if (chargeId) {
      charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
      if (!charge) {
        return {
          __typename: 'CommonError',
          message: `Charge with id ${chargeId} not found`,
        };
      }
    }

    const {
      ownerId: writeTargetOwnerId,
      defaultLocalCurrency,
      ledgerLock,
      authorities,
    } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
    if (charge) {
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
    }

    // A new charge belongs to the write target, the only business this request can write to
    const ownerId = charge?.owner_id ?? writeTargetOwnerId;
    const checked = checkManualLedgerRecord(
      input,
      { chargeId: charge?.id, ownerId },
      { localCurrency: defaultLocalCurrency, ledgerLock },
    );
    if ('error' in checked) {
      return checked.error;
    }
    const { params } = checked;
    const owned = await loadOwnedEntityTypes(injector, input, ownerId);
    if ('error' in owned) {
      return owned.error;
    }

    // Derive the backing entity before opening the transaction, so it only holds the writes
    let insertEntity: (chargeId: string) => Promise<void>;
    switch (operation) {
      case 'MISC_EXPENSE': {
        const miscExpense = deriveMiscExpenseFromLedgerInput(input, {
          localCurrency: defaultLocalCurrency,
        });
        insertEntity = async chargeId => {
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
        const derived = deriveDocument(input, {
          ownerId,
          entityTypes: owned.entityTypes,
          localCurrency: defaultLocalCurrency,
          inputVatTaxCategoryId: authorities.inputVatTaxCategoryId,
          outputVatTaxCategoryId: authorities.outputVatTaxCategoryId,
        });
        if ('error' in derived) {
          return derived.error;
        }
        const { document } = derived;
        insertEntity = async chargeId => {
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
    // transaction's connection; throwing inside the callback rolls every write back, including a
    // new charge and an existing charge's re-flagging
    return await injector.get(TenantAwareDBClient).transaction(async () => {
      if (!charge) {
        const newCharge = await injector
          .get(ChargesProvider)
          .generateCharge({ ownerId, ...deriveNewChargeFromLedgerInput(input) });
        if (!newCharge) {
          throw new Error('Charge was not created');
        }
        const record = await insertEntityAndRecord(newCharge.id);
        // A new charge is unapproved already, so there is nothing to re-flag; `generateCharge`
        // primed the loader with it
        const createdCharge = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.load(newCharge.id);
        if (!createdCharge) {
          throw new Error(`Charge with id ${newCharge.id} not found`);
        }
        return { record, charge: createdCharge };
      }

      const record = await insertEntityAndRecord(charge.id);
      return {
        record,
        charge: await degradeAndLoadCharge(injector, charge.id, charge),
      };
    });

    async function insertEntityAndRecord(targetChargeId: string) {
      await insertEntity(targetChargeId);
      const [ledgerRecord] = await injector.get(LedgerProvider).insertLedgerRecords({
        ledgerRecords: [{ ...params, chargeId: targetChargeId, ownerId }],
      });
      if (!ledgerRecord) {
        throw new Error('Ledger record was not inserted');
      }
      return ledgerRecord;
    }
  } catch (e) {
    console.error(`Failed to insert ledger record ${chargeLabel}`, e);
    return {
      __typename: 'CommonError',
      message: `Failed to insert ledger record ${chargeLabel}`,
    };
  }
}
