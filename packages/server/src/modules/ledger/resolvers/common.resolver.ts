import { LedgerProvider } from '../providers/ledger.provider.js';
import { LedgerModule } from '../types.js';

export const commonChargeLedgerResolver: LedgerModule.ChargeResolvers = {
  ledger: async (DbCharge, _, { injector }) => {
    const ledgerRecords = await injector
      .get(LedgerProvider)
      .getLedgerRecordsByChargesIdLoader.load(DbCharge.id);

    return {
      records: ledgerRecords.sort((a, b) =>
        a.invoice_date.getTime() < b.invoice_date.getTime() ? 1 : -1,
      ),
      charge: DbCharge,
      errors: [],
    };
  },
};
