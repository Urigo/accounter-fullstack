import { GraphQLError } from 'graphql';
import { TempChargesProvider } from '@modules/charges/providers/temp-charges.provider.js';
import { LedgerProvider } from '../providers/ledger.provider.js';
import { LedgerModule } from '../types.js';

export const commonChargeLedgerResolver: LedgerModule.ChargeResolvers = {
  ledger: async (DbCharge, _, { injector }) => {
    const [ledgerRecords, charge] = await Promise.all([
      injector.get(LedgerProvider).getLedgerRecordsByChargesIdLoader.load(DbCharge.id),
      injector.get(TempChargesProvider).getTempChargeByIdLoader.load(DbCharge.id),
    ]);

    if (!charge) {
      throw new GraphQLError(`Charge ID=${DbCharge.id} not found`);
    }

    return {
      records: ledgerRecords.sort((a, b) =>
        a.invoice_date.getTime() < b.invoice_date.getTime() ? 1 : -1,
      ),
      charge,
      errors: [],
    };
  },
};
