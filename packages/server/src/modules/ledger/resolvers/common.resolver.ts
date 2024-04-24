import { LedgerProvider } from '../providers/ledger.provider.js';
import { LedgerModule } from '../types.js';

export const commonChargeLedgerResolver: LedgerModule.ChargeResolvers = {
  ledger: async (DbCharge, _, { injector }) => {
    const ledgerRecords = await injector
      .get(LedgerProvider)
      .getLedgerRecordsByChargesIdLoader.load(DbCharge.id);

    return {
      records: ledgerRecords,
      charge: DbCharge,
      errors: [],
    };
  },
};
