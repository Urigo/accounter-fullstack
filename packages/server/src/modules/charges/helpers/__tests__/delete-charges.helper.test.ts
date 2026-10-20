import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { BankDepositChargesProvider } from '../../../bank-deposits/providers/bank-deposit-charges.provider.js';
import { BusinessTripsProvider } from '../../../business-trips/providers/business-trips.provider.js';
import { BalanceCancellationProvider } from '../../../ledger/providers/balance-cancellation.provider.js';
import { LedgerProvider } from '../../../ledger/providers/ledger.provider.js';
import { UnbalancedBusinessesProvider } from '../../../ledger/providers/unbalanced-businesses.provider.js';
import { ChargeTagsProvider } from '../../../tags/providers/charge-tags.provider.js';
import { ChargeSpreadProvider } from '../../providers/charge-spread.provider.js';
import { ChargesProvider } from '../../providers/charges.provider.js';
import { deleteCharges } from '../delete-charges.helper.js';

/**
 * `deleteCharges` clears the records that only annotate a charge before deleting it — their
 * foreign keys would otherwise block the delete. Balance cancellations were missing from that list,
 * so a charge carrying one could not be deleted.
 */

const CHARGE_A = 'cc000000-0000-4000-8000-00000000000a';
const CHARGE_B = 'cc000000-0000-4000-8000-00000000000b';

function buildInjector() {
  const calls: string[] = [];
  const record =
    (name: string) =>
    async (...args: unknown[]) => {
      calls.push(`${name}:${JSON.stringify(args)}`);
      return [];
    };

  const deleteBalanceCancellation = vi.fn(record('balanceCancellation'));
  const deleteChargesByIds = vi.fn(record('charges'));

  const injector = {
    get: (token: unknown) => {
      switch (token) {
        case BankDepositChargesProvider:
          return { unlinkChargesFromBankDepositsByChargeIds: record('bankDeposits') };
        case ChargeTagsProvider:
          return { clearAllChargeTags: record('tags') };
        case BusinessTripsProvider:
          return { updateChargeBusinessTrip: record('businessTrip') };
        case LedgerProvider:
          return { deleteLedgerRecordsByChargeIdLoader: { load: record('ledger') } };
        case ChargeSpreadProvider:
          return { deleteAllChargeSpreadByChargeIds: record('spread') };
        case UnbalancedBusinessesProvider:
          return { deleteChargeUnbalancedBusinessesByChargeId: record('unbalanced') };
        case BalanceCancellationProvider:
          return { deleteBalanceCancellationByChargeIdLoader: { load: deleteBalanceCancellation } };
        case ChargesProvider:
          return { deleteChargesByIds };
        default:
          throw new Error('unexpected provider requested');
      }
    },
  } as unknown as Injector;

  return { injector, calls, deleteBalanceCancellation, deleteChargesByIds };
}

describe('deleteCharges', () => {
  it('clears balance cancellations of every charge before deleting the charges', async () => {
    const { injector, calls, deleteBalanceCancellation, deleteChargesByIds } = buildInjector();

    await deleteCharges([CHARGE_A, CHARGE_B], injector);

    expect(deleteBalanceCancellation).toHaveBeenCalledWith(CHARGE_A);
    expect(deleteBalanceCancellation).toHaveBeenCalledWith(CHARGE_B);
    expect(deleteChargesByIds).toHaveBeenCalledWith({ chargeIds: [CHARGE_A, CHARGE_B] });
    expect(calls.at(-1)).toMatch(/^charges:/);
  });
});
