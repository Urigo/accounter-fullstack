import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { BankDepositChargesProvider } from 'modules/bank-deposits/providers/bank-deposit-charges.provider.js';
import { BusinessTripsProvider } from '../../business-trips/providers/business-trips.provider.js';
import { LedgerProvider } from '../../ledger/providers/ledger.provider.js';
import { UnbalancedBusinessesProvider } from '../../ledger/providers/unbalanced-businesses.provider.js';
import { ChargeTagsProvider } from '../../tags/providers/charge-tags.provider.js';
import { ChargeSpreadProvider } from '../providers/charge-spread.provider.js';
import { ChargesProvider } from '../providers/charges.provider.js';

async function clearChargeDependencies(chargeId: string, injector: Injector) {
  try {
    // clear tags
    const clearAllChargeTagsPromise = injector
      .get(ChargeTagsProvider)
      .clearAllChargeTags({ chargeId })
      .catch(e => {
        console.error(e);
        throw new Error(`Failed to clear tags`);
      });

    // clear business trips
    const clearBusinessTripsPromise = injector
      .get(BusinessTripsProvider)
      .updateChargeBusinessTrip(chargeId, null)
      .catch(e => {
        const message = `Failed to clear business trip for charge ID="${chargeId}"`;
        console.error(`${message}: ${e}`);
        if (e instanceof GraphQLError) {
          throw e;
        }
        throw new Error(message);
      });

    // clear ledger records
    const clearLedgerPromise = injector
      .get(LedgerProvider)
      .deleteLedgerRecordsByChargeIdLoader.load(chargeId)
      .catch(e => {
        const message = `Failed to clear ledger records for charge ID="${chargeId}"`;
        console.error(`${message}: ${e}`);
        if (e instanceof GraphQLError) {
          throw e;
        }
        throw new Error(message);
      });

    // clear charge spread
    const clearSpreadPromise = injector
      .get(ChargeSpreadProvider)
      .deleteAllChargeSpreadByChargeIds({ chargeIds: [chargeId] })
      .catch(e => {
        const message = `Failed to clear spread info for charge ID="${chargeId}"`;
        console.error(`${message}: ${e}`);
        if (e instanceof GraphQLError) {
          throw e;
        }
        throw new Error(message);
      });

    // clear unbalanced businesses
    const clearUnbalancedBusinessesPromise = injector
      .get(UnbalancedBusinessesProvider)
      .deleteChargeUnbalancedBusinessesByChargeId({ chargeId })
      .catch(e => {
        const message = `Failed to clear unbalanced businesses for charge ID="${chargeId}"`;
        console.error(`${message}: ${e}`);
        if (e instanceof GraphQLError) {
          throw e;
        }
        throw new Error(message);
      });

    await Promise.all([
      clearAllChargeTagsPromise,
      clearBusinessTripsPromise,
      clearLedgerPromise,
      clearSpreadPromise,
      clearUnbalancedBusinessesPromise,
    ]);
  } catch (e) {
    if (e instanceof GraphQLError) {
      throw e;
    }
    throw new GraphQLError(`Charge ID="${chargeId}" deletion error: ${e}`);
  }
}

export async function deleteCharges(chargeIds: string[], injector: Injector): Promise<void> {
  // clear assigned bank deposits
  const clearAssignedBankDepositsPromise = injector
    .get(BankDepositChargesProvider)
    .deleteChargeDepositsByChargeIds(chargeIds)
    .catch(e => {
      const message = `Failed to clear assigned bank deposits for charge IDs="${chargeIds.join(', ')}"`;
      console.error(`${message}: ${e}`);
      if (e instanceof GraphQLError) {
        throw e;
      }
      throw new Error(message);
    });
  await Promise.all([
    ...chargeIds.map(id => clearChargeDependencies(id, injector)),
    clearAssignedBankDepositsPromise,
  ]);

  try {
    await injector.get(ChargesProvider).deleteChargesByIds({ chargeIds });
  } catch (e) {
    if (e instanceof GraphQLError) {
      throw e;
    }
    console.error(`Failed to delete charge IDs="${chargeIds}"`, e);
    throw new GraphQLError(`Failed to delete charge IDs=[${chargeIds}]`);
  }

  return void 0;
}
