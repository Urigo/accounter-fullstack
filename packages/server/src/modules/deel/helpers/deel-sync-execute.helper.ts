import type { Injector } from 'graphql-modules';
import { hashStringToInt } from '../../../shared/helpers/index.js';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { CloudinaryProvider, type CloudinaryResourceType } from '../../app-providers/cloudinary.js';
import { DeelClientProvider } from '../../app-providers/deel/deel-client.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { deleteCharges } from '../../charges/helpers/delete-charges.helper.js';
import { isChargeEmpty } from '../../charges/helpers/delete-empty-charges.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import {
  releaseDbConnectionForExternalWork,
  uploadToCloudinary,
} from '../../documents/helpers/upload.helper.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { DeelInvoicesProvider } from '../providers/deel-invoices.provider.js';
import {
  DeelSyncConflictError,
  describeErrorForUser,
  hasDatabaseErrorCode,
  type DeelSyncIssue,
} from './deel-sync-errors.js';
import { describeUnit, getUnitInvoiceIds, type DeelSyncUnit } from './deel-sync-plan.helper.js';
import {
  buildDeelInvoiceDocument,
  convertMatchToDeelInvoiceRecord,
  convertMatchToPartialDeelInvoiceRecord,
  getDeelChargeDescription,
  type DeelInvoiceMatch,
} from './deel.helper.js';

export type DeelSyncContext = {
  ownerId: string;
  deelBusinessId: string;
};

type UploadedInvoiceFile = {
  fileUrl: string;
  imageUrl: string;
  fileHash: string;
  publicId: string;
  resourceType: CloudinaryResourceType;
};

export type PreparedUnit = {
  /** Description of the charge to generate, when the unit has no charge yet */
  chargeDescription: string | null;
  files: Map<string, UploadedInvoiceFile>;
};

export type UnitOutcome =
  { ok: true; chargeId: string; warnings: DeelSyncIssue[] } | { ok: false; issue: DeelSyncIssue };

/** A failure while saving a unit, naming the step it failed at */
class UnitPersistError extends Error {
  constructor(step: string, cause: unknown) {
    super(`failed while ${step}`, { cause });
    this.name = 'UnitPersistError';
  }
}

function unitInserts(unit: DeelSyncUnit): DeelInvoiceMatch[] {
  return unit.kind === 'receipt' ? unit.inserts : [unit.invoice];
}

function unitUpdates(unit: DeelSyncUnit): DeelInvoiceMatch[] {
  return unit.kind === 'receipt' ? unit.updates : [];
}

async function deleteUploads(injector: Injector, files: Iterable<UploadedInvoiceFile>) {
  for (const file of files) {
    try {
      await injector.get(CloudinaryProvider).deleteUpload(file.publicId, file.resourceType);
    } catch (error) {
      console.warn(`Failed to remove orphan Deel invoice upload [${file.publicId}]:`, error);
    }
  }
}

/** The description of the charge to generate for a unit that has none yet — reads the DB */
export async function resolveChargeDescription(
  injector: Injector,
  unit: DeelSyncUnit,
): Promise<string | null> {
  if (unit.existingChargeId) {
    return null;
  }
  return unit.kind === 'receipt'
    ? getDeelChargeDescription(injector, unit.workers)
    : `Deel invoice ${unit.invoice.label}`;
}

/**
 * The external part of a unit, done before its transaction opens: download each new invoice's file
 * from Deel and upload it. On failure, files already uploaded for the unit are removed again.
 */
export async function prepareUnitFiles(
  injector: Injector,
  unit: DeelSyncUnit,
): Promise<Map<string, UploadedInvoiceFile>> {
  // minutes of downloads and uploads ahead — don't hold a pooled connection idle through them
  await releaseDbConnectionForExternalWork(injector);

  const files = new Map<string, UploadedInvoiceFile>();
  try {
    for (const match of unitInserts(unit)) {
      const file = await injector.get(DeelClientProvider).getSalaryInvoiceFile(match.id);
      const fileHash = hashStringToInt(await file.text()).toString();
      const upload = await uploadToCloudinary(injector, file).catch(error => {
        throw new Error(`Failed to upload Deel invoice file [${match.id}]`, { cause: error });
      });
      files.set(match.id, { ...upload, fileHash });
    }
  } catch (error) {
    await deleteUploads(injector, files.values());
    throw error;
  }

  return files;
}

/** Delete a charge left empty (see `isChargeEmpty`); returns whether it was deleted */
async function deleteChargeIfEmpty(injector: Injector, chargeId: string): Promise<boolean> {
  // a savepoint, so a failed check or delete (e.g. a locked ledger) doesn't abort the unit's
  // transaction
  return injector.get(TenantAwareDBClient).transaction(async () => {
    if (!(await isChargeEmpty(chargeId, injector))) {
      return false;
    }
    await deleteCharges([chargeId], injector);
    return true;
  });
}

/**
 * Save one unit in a single transaction: its charge, documents and `deel_invoices` rows land
 * together or not at all.
 */
export async function persistUnit(
  injector: Injector,
  unit: DeelSyncUnit,
  prepared: PreparedUnit,
  context: DeelSyncContext,
): Promise<{ chargeId: string; warnings: DeelSyncIssue[] }> {
  const inserts = unitInserts(unit);
  const updates = unitUpdates(unit);
  let step = 'locking the invoices';

  try {
    return await injector.get(TenantAwareDBClient).transaction(async () => {
      const warnings: DeelSyncIssue[] = [];
      const deelInvoicesProvider = injector.get(DeelInvoicesProvider);
      const documentsProvider = injector.get(DocumentsProvider);

      // another sync run may be saving the same invoices, or have saved them since they were read:
      // the advisory locks serialize runs (also for invoices that have no row yet), the row lock
      // reads their current state
      const invoiceIds = getUnitInvoiceIds(unit);
      await deelInvoicesProvider.lockInvoiceIdsForSync(invoiceIds);
      const lockedRows = await deelInvoicesProvider.lockInvoicesForSync(invoiceIds);
      const storedById = new Map(lockedRows.map(row => [row.id, row]));
      for (const match of inserts) {
        if (storedById.has(match.id)) {
          throw new DeelSyncConflictError(
            `Deel invoice [${match.id}] was saved by another sync run in the meantime`,
          );
        }
      }
      for (const match of updates) {
        const stored = storedById.get(match.id);
        if (!stored) {
          throw new DeelSyncConflictError(
            `the stored row of Deel invoice [${match.id}] was removed by another operation in the meantime`,
          );
        }
        if (stored.payment_id) {
          throw new DeelSyncConflictError(
            `Deel invoice [${match.id}] was matched to a payment by another sync run in the meantime`,
          );
        }
        if (!stored.document_id) {
          throw new Error(
            `Deel invoice [${match.id}] has no document to move to the receipt's charge`,
          );
        }
      }

      step = 'creating the charge';
      let chargeId = unit.existingChargeId;
      if (!chargeId) {
        const charge = await injector.get(ChargesProvider).generateCharge({
          ownerId: context.ownerId,
          userDescription: prepared.chargeDescription,
        });
        if (!charge?.id) {
          throw new Error('The charge was not created');
        }
        chargeId = charge.id;
      }

      for (const match of inserts) {
        const file = prepared.files.get(match.id);
        if (!file) {
          throw new Error(`The file of Deel invoice [${match.id}] was not prepared`);
        }

        step = `inserting the document of Deel invoice [${match.id}]`;
        const [document] = await documentsProvider.insertDocuments({
          documents: [
            buildDeelInvoiceDocument({
              match,
              chargeId,
              ownerId: context.ownerId,
              deelBusinessId: context.deelBusinessId,
              file,
            }),
          ],
        });
        if (!document?.id) {
          throw new Error('The document was not created');
        }

        step = `inserting the deel_invoices row of Deel invoice [${match.id}]`;
        try {
          await deelInvoicesProvider.insertDeelInvoiceRecords(
            convertMatchToDeelInvoiceRecord(match, document.id),
          );
        } catch (error) {
          // the advisory lock makes this unlikely, but a unique violation still means another run
          // saved the invoice
          if (hasDatabaseErrorCode(error, '23505')) {
            throw new DeelSyncConflictError(
              `Deel invoice [${match.id}] was saved by another sync run in the meantime`,
              { cause: error },
            );
          }
          throw error;
        }
      }

      const previousChargeIds = new Set<string>();
      for (const match of updates) {
        const stored = storedById.get(match.id)!;

        step = `moving the document of Deel invoice [${match.id}] to the receipt's charge`;
        await documentsProvider.updateDocument({ documentId: stored.document_id!, chargeId });
        if (stored.charge_id && stored.charge_id !== chargeId) {
          previousChargeIds.add(stored.charge_id);
        }

        step = `updating the deel_invoices row of Deel invoice [${match.id}]`;
        await deelInvoicesProvider.updateDeelInvoiceRecords(
          convertMatchToPartialDeelInvoiceRecord(match),
        );
      }

      // the charges the moved documents came from may be left empty
      const survivingPreviousChargeIds: string[] = [];
      for (const previousChargeId of previousChargeIds) {
        step = `cleaning up the previous charge [${previousChargeId}]`;
        try {
          if (!(await deleteChargeIfEmpty(injector, previousChargeId))) {
            survivingPreviousChargeIds.push(previousChargeId);
          }
        } catch (error) {
          survivingPreviousChargeIds.push(previousChargeId);
          console.error(`Failed to delete empty charge [${previousChargeId}]:`, error);
          warnings.push({
            code: 'CLEANUP_FAILED',
            message: `${describeUnit(unit)} was synced, but its documents' previous charge [${previousChargeId}] is now empty and could not be deleted: ${describeErrorForUser(error)}`,
            invoiceIds: updates.map(match => match.id),
            receiptId: unit.kind === 'receipt' ? unit.receiptId : null,
          });
        }
      }

      step = 'resetting the accountant approval of the affected charges';
      await degradeChargesAccountantApproval(injector, [
        unit.existingChargeId,
        ...survivingPreviousChargeIds,
      ]);

      return { chargeId, warnings };
    });
  } catch (error) {
    if (error instanceof DeelSyncConflictError) {
      throw error;
    }
    throw new UnitPersistError(step, error);
  }
}

/** Forget cached rows a rolled-back transaction may have left behind */
function clearCaches(injector: Injector) {
  injector.get(ChargesProvider).clearCache();
  injector.get(DocumentsProvider).clearCache();
  injector.get(DeelInvoicesProvider).clearCache();
}

/** Prepare and save one unit. Failures are returned as an issue — the unit wrote nothing. */
export async function syncUnit(
  injector: Injector,
  unit: DeelSyncUnit,
  context: DeelSyncContext,
): Promise<UnitOutcome> {
  const invoiceIds = getUnitInvoiceIds(unit);
  const receiptId = unit.kind === 'receipt' ? unit.receiptId : null;
  const unitName = describeUnit(unit);

  let chargeDescription: string | null;
  try {
    chargeDescription = await resolveChargeDescription(injector, unit);
  } catch (error) {
    console.error(`Failed reading the contract workers of ${unitName}:`, error);
    return {
      ok: false,
      issue: {
        code: 'PERSIST_FAILED',
        message: `Reading the contract workers of ${unitName} failed: ${describeErrorForUser(error)}. Nothing was saved for it.`,
        invoiceIds,
        receiptId,
      },
    };
  }

  let files: Map<string, UploadedInvoiceFile>;
  try {
    files = await prepareUnitFiles(injector, unit);
  } catch (error) {
    console.error(`Failed preparing the invoice files of ${unitName}:`, error);
    return {
      ok: false,
      issue: {
        code: 'INVOICE_FILE_UNAVAILABLE',
        message: `${unitName} was not synced, as its invoice files could not be fetched and stored: ${describeErrorForUser(error)}`,
        invoiceIds,
        receiptId,
      },
    };
  }
  const prepared: PreparedUnit = { chargeDescription, files };

  try {
    const { chargeId, warnings } = await persistUnit(injector, unit, prepared, context);
    return { ok: true, chargeId, warnings };
  } catch (error) {
    console.error(`Failed saving ${unitName}:`, error);
    clearCaches(injector);
    await deleteUploads(injector, prepared.files.values());
    if (error instanceof DeelSyncConflictError) {
      return {
        ok: false,
        issue: {
          code: 'ALREADY_PROCESSED',
          message: `${unitName} was not synced: ${error.message}. Re-run to pick up the current state.`,
          invoiceIds,
          receiptId,
        },
      };
    }
    return {
      ok: false,
      issue: {
        code: 'PERSIST_FAILED',
        message: `Saving ${unitName} ${describeErrorForUser(error)}. Nothing was saved for it.`,
        invoiceIds,
        receiptId,
      },
    };
  }
}
