import { formatFinancialAmount } from '../../../helpers/amount.mjs';
import { TaxesModule } from '../generated-types/graphql';

export const resolvers: TaxesModule.Resolvers = {
  Charge: {
    vat: DbCharge => (DbCharge.vat != null ? formatFinancialAmount(DbCharge.vat, DbCharge.currency_code) : null),
    withholdingTax: DbCharge =>
      DbCharge.withholding_tax != null ? formatFinancialAmount(DbCharge.withholding_tax, DbCharge.currency_code) : null,
    property: DbCharge => DbCharge.is_property,
  },
};
