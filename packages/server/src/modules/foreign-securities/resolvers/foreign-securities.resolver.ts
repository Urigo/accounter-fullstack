import { errorSimplifier } from '../../../shared/errors.js';
import { ForeignSecuritiesProvider } from '../providers/foreign-securities.provider.js';
import type { ForeignSecuritiesModule } from '../types.js';

export const foreignSecuritiesResolvers: ForeignSecuritiesModule.Resolvers = {
  ForeignSecuritiesCharge: {
    securities: async (dbCharge, _, { injector }) => {
      try {
        return await injector.get(ForeignSecuritiesProvider).getChargeSecurities(dbCharge.id);
      } catch (e) {
        throw errorSimplifier(`Error fetching securities for charge ${dbCharge.id}`, e);
      }
    },
  },
  ChargeSecurity: {
    id: chargeSecurity => chargeSecurity.id,
    securityKey: chargeSecurity => chargeSecurity.securityKey,
    details: chargeSecurity => chargeSecurity.details,
    // Transaction concrete types are mapped to their id (see codegen.ts mappers).
    transactions: chargeSecurity => chargeSecurity.transactionIds,
  },
  Security: {
    id: security => security.id,
    key: security => security.security_key,
    engName: security => security.eng_name,
    hebName: security => security.heb_name,
    symbol: security => security.symbol,
    engSymbol: security => security.eng_symbol,
    hebSymbol: security => security.heb_symbol,
    itemType: security => security.item_type,
    stockType: security => security.stock_type,
    // The source uses '' for "no exchange"; null is the honest representation.
    exchange: security => security.exchange || null,
    currencyCode: security => security.currency_code,
    isEtf: security => security.is_etf,
    isForeign: security => security.is_foreign,
    asOfDate: security => security.as_of_date,
  },
};
