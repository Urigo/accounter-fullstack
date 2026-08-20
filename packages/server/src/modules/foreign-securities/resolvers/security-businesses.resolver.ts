import { GraphQLError } from 'graphql';
import { Currency } from '../../../shared/enums.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { SecurityBusinessesProvider } from '../providers/security-businesses.provider.js';
import type { ForeignSecuritiesModule } from '../types.js';

export const securityBusinessesResolvers: ForeignSecuritiesModule.Resolvers = {
  Query: {
    allSecurityBusinesses: async (_, __, { injector }) => {
      const securityBusinesses = await injector
        .get(SecurityBusinessesProvider)
        .getAllSecurityBusinesses();

      const businesses = await injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.loadMany(securityBusinesses.map(security => security.id));

      // A security row whose business vanished is a broken FK, not a reason to fail the query.
      return businesses.filter(
        (business): business is Exclude<(typeof businesses)[number], Error | undefined | null> =>
          business != null && !(business instanceof Error),
      );
    },
  },
  LtdFinancialEntity: {
    securityInfo: async (business, _, { injector }) =>
      (await injector
        .get(SecurityBusinessesProvider)
        .getSecurityBusinessByIdLoader.load(business.id)) ?? null,
  },
  SecurityBusiness: {
    id: securityBusiness => securityBusiness.id,
    business: async (securityBusiness, _, { injector }) => {
      const business = await injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.load(securityBusiness.id);
      if (!business) {
        throw new GraphQLError(`Business ID="${securityBusiness.id}" not found`);
      }
      return business;
    },
    isin: securityBusiness => securityBusiness.isin,
    identifiers: async (securityBusiness, _, { injector }) =>
      injector
        .get(SecurityBusinessesProvider)
        .getIdentifiersByBusinessIdLoader.load(securityBusiness.id),
    symbol: securityBusiness => securityBusiness.symbol,
    engName: securityBusiness => securityBusiness.eng_name,
    hebName: securityBusiness => securityBusiness.heb_name,
    exchange: securityBusiness => securityBusiness.exchange,
    // The column is accounter_schema.currency, whose values are the GraphQL enum's — the same
    // cast the financial-accounts resolvers use for their currency columns.
    currencyCode: securityBusiness => securityBusiness.currency_code as Currency | null,
    itemType: securityBusiness => securityBusiness.item_type,
    stockType: securityBusiness => securityBusiness.stock_type,
    isEtf: securityBusiness => securityBusiness.is_etf,
    isForeign: securityBusiness => securityBusiness.is_foreign,
    issuerCountryCode: securityBusiness => securityBusiness.issuer_country_code,
  },
  SecurityIdentifier: {
    id: identifier => identifier.id,
    type: identifier => identifier.identifier_type,
    value: identifier => identifier.identifier_value,
  },
};
