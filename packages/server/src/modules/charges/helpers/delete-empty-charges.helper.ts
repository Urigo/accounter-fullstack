import { Injector } from 'graphql-modules';
import { EMPTY_UUID } from '../../../shared/constants.js';
import { BusinessTripEmployeePaymentsProvider } from '../../business-trips/providers/business-trips-employee-payments.provider.js';
import { DepreciationProvider } from '../../depreciation/providers/depreciation.provider.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { SecurityExecutionChargesProvider } from '../../foreign-securities/providers/security-execution-charges.provider.js';
import { MiscExpensesProvider } from '../../misc-expenses/providers/misc-expenses.provider.js';
import { SalariesProvider } from '../../salaries/providers/salaries.provider.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { ChargesProvider } from '../providers/charges.provider.js';
import { deleteCharges } from './delete-charges.helper.js';

type ByChargeIdLoader = {
  clear: (chargeId: string) => unknown;
  load: (chargeId: string) => Promise<readonly unknown[]>;
};

/**
 * Whether a charge holds nothing: no transactions, documents or misc expenses, and none of the
 * other records that hang off a charge (salary records, business trip employee payments,
 * depreciation records, securities executions it books directly). Those are content of their own, so a charge holding any of them is not
 * empty. Records that only annotate a charge (tags, ledger records, balance cancellations, …) are
 * not counted: `deleteCharges` deletes them with the charge.
 *
 * The per-charge loader entries are cleared first, so the check reflects the
 * current DB state rather than what an earlier read in the same request cached
 * (callers run it right after moving / deleting records).
 */
export async function isChargeEmpty(chargeId: string, injector: Injector): Promise<boolean> {
  const loaders: ByChargeIdLoader[] = [
    injector.get(TransactionsProvider).transactionsByChargeIDLoader,
    injector.get(DocumentsProvider).getDocumentsByChargeIdLoader,
    injector.get(MiscExpensesProvider).getExpensesByChargeIdLoader,
    injector.get(SalariesProvider).getSalaryRecordsByChargeIdLoader,
    injector.get(BusinessTripEmployeePaymentsProvider)
      .getBusinessTripEmployeePaymentsByChargeIdLoader,
    injector.get(DepreciationProvider).getDepreciationRecordsByChargeIdLoader,
    injector.get(SecurityExecutionChargesProvider).linkedExecutionIdsByChargeIdLoader,
  ];

  const records = await Promise.all(
    loaders.map(loader => {
      loader.clear(chargeId);
      return loader.load(chargeId);
    }),
  );

  return records.every(rows => rows.length === 0);
}

/**
 * Delete the given charges that are left empty (see `isChargeEmpty`), to avoid
 * leaving ghost charges behind once their transactions / documents / misc
 * expenses were moved elsewhere or deleted. Call it after the write succeeded,
 * with the charges the records were taken off.
 *
 * Empty / EMPTY_UUID ids are ignored, the list is de-duplicated, and ids in
 * `keepChargeIds` (e.g. the charge the records were just moved into) are never
 * deleted.
 *
 * Cleanup is best-effort: the preceding write is already committed, so a
 * failure to check or delete a charge is logged and that charge is skipped
 * rather than failing the caller.
 *
 * Returns the ids of the charges actually deleted.
 */
export async function deleteChargesIfEmpty(
  chargeIds: ReadonlyArray<string | null | undefined>,
  injector: Injector,
  options: { keepChargeIds?: ReadonlyArray<string | null | undefined> } = {},
): Promise<string[]> {
  const keepChargeIds = new Set(options.keepChargeIds ?? []);
  const candidateIds = [
    ...new Set(
      chargeIds.filter(
        (id): id is string =>
          typeof id === 'string' && id.length > 0 && id !== EMPTY_UUID && !keepChargeIds.has(id),
      ),
    ),
  ];
  if (candidateIds.length === 0) {
    return [];
  }

  const chargesProvider = injector.get(ChargesProvider);

  const emptyChargeIds = await Promise.all(
    candidateIds.map(async chargeId => {
      try {
        const charge = await chargesProvider.getChargeByIdLoader.load(chargeId);
        if (!charge) {
          return null;
        }
        return (await isChargeEmpty(chargeId, injector)) ? chargeId : null;
      } catch (e) {
        console.error(`Failed to check whether charge ID="${chargeId}" is empty:`, e);
        return null;
      }
    }),
  ).then(ids => ids.filter((id): id is string => !!id));

  const deletedChargeIds: string[] = [];
  await Promise.all(
    emptyChargeIds.map(async chargeId => {
      try {
        await deleteCharges([chargeId], injector);
        await chargesProvider.invalidateCharge(chargeId);
        deletedChargeIds.push(chargeId);
      } catch (e) {
        console.error(`Failed to delete empty charge ID="${chargeId}":`, e);
      }
    }),
  );

  return deletedChargeIds;
}
