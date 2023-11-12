import { isBatchedCharge } from '../helpers/batched-salary.helper.js';
import { getSalaryMonth } from '../helpers/get-month.helper.js';
import { SalariesProvider } from '../providers/salaries.provider.js';
import { SalariesModule } from '../types.js';

export const commonSalaryFields: SalariesModule.ChargeResolvers = {
  salaryRecords: (DbCharge, _, { injector }) => {
    const dateString = DbCharge.transactions_min_event_date?.toISOString().slice(0, 7);
    if (!dateString) {
      return [];
    }
    const month = getSalaryMonth(DbCharge);
    if (!month) {
      return [];
    }
    console.log(month);
    const isBatched = isBatchedCharge(DbCharge);
    return injector
      .get(SalariesProvider)
      .getSalaryRecordsByMonthLoader.load(month)
      .then(
        res =>
          res?.filter(
            record =>
              isBatched ||
              DbCharge.transactions_event_amount?.replace('-', '') ===
                record.direct_payment_amount?.replace('-', ''),
          ),
      );
  },
};
