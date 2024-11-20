import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { UnbalancedBusinessesProvider } from '@modules/ledger/providers/unbalanced-businesses.provider.js';
import { BusinessTripsProvider } from '../../business-trips/providers/business-trips.provider.js';
import { ChargeTagsProvider } from '../../tags/providers/charge-tags.provider.js';
import { ChargeSpreadProvider } from '../providers/charge-spread.provider.js';
import { TempChargesProvider } from '../providers/temp-charges.provider.js';

export async function deleteCharges(chargeIds: string[], injector: Injector): Promise<void> {
  for (const chargeId of chargeIds) {
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
          console.error(e);
          throw new Error(`Failed to clear business trip`);
        });

      // clear ledger records
      const clearLedgerPromise = injector
        .get(LedgerProvider)
        .deleteLedgerRecordsByChargeIdLoader.load(chargeId)
        .catch(e => {
          console.error(e);
          throw new Error(`Failed to clear business trip`);
        });

      // clear charge spread
      const clearSpreadPromise = injector
        .get(ChargeSpreadProvider)
        .deleteAllChargeSpreadByChargeIds({ chargeIds: [chargeId] })
        .catch(e => {
          console.error(e);
          throw new Error(`Failed to clear business trip`);
        });

      // clear unbalanced businesses
      const clearUnbalancedBusinessesPromise = injector
        .get(UnbalancedBusinessesProvider)
        .deleteChargeUnbalancedBusinessesByChargeId({ chargeId })
        .catch(e => {
          console.error(e);
          throw new Error(`Failed to clear unbalanced businesses`);
        });

      await Promise.all([
        clearAllChargeTagsPromise,
        clearBusinessTripsPromise,
        clearLedgerPromise,
        clearSpreadPromise,
        clearUnbalancedBusinessesPromise,
      ]);
    } catch (e) {
      throw new GraphQLError(`Charge ID="${chargeId}" deletion error: ${e}`);
    }
  }

  try {
    await injector.get(TempChargesProvider).deleteChargesByIds({ chargeIds });
  } catch (e) {
    console.error(`Failed to delete charge IDs="${chargeIds}"`, e);
    throw new GraphQLError(`Failed to delete charge IDs=[${chargeIds}]`);
  }

  return void 0;
}
