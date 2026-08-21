import { GraphQLError } from 'graphql';
import { Currency } from '../../../shared/enums.js';
import { formatFinancialAmount } from '../../../shared/helpers/amount.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { calculateSecurityPosition, isOpenPosition } from '../helpers/security-position.helper.js';
import { ForeignSecuritiesProvider } from '../providers/foreign-securities.provider.js';
import { SecurityBusinessesProvider } from '../providers/security-businesses.provider.js';
import type { ForeignSecuritiesModule } from '../types.js';

/** An amount the executions imply, or null when they imply nothing. */
const positionAmount = (value: number | null, currency: string | null) =>
  value == null || currency == null ? null : formatFinancialAmount(value, currency);

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
    securityHoldings: async (_, { includeClosed }, { injector }) => {
      const securityBusinesses = await injector
        .get(SecurityBusinessesProvider)
        .getAllSecurityBusinesses();
      const executionsByBusinessId = await injector
        .get(ForeignSecuritiesProvider)
        .getExecutionsBySecurityBusiness();

      return (
        securityBusinesses
          .map(securityBusiness => ({
            id: securityBusiness.id,
            security: securityBusiness,
            position: {
              id: securityBusiness.id,
              ...calculateSecurityPosition(executionsByBusinessId.get(securityBusiness.id) ?? []),
            },
          }))
          // Closed positions are the bulk of a long-lived portfolio, so the screen asks for them
          // explicitly. A security with nothing ingested against it reads as closed too.
          .filter(holding => includeClosed || isOpenPosition(holding.position))
          // Ordered here so an unsorted render is stable across requests.
          .sort((a, b) =>
            (a.security.eng_name ?? a.security.isin).localeCompare(
              b.security.eng_name ?? b.security.isin,
            ),
          )
      );
    },
    securityBusinessHistory: async (_, { businessId }, { injector }) => {
      const securityBusiness = await injector
        .get(SecurityBusinessesProvider)
        .getSecurityBusinessByIdLoader.load(businessId);
      if (!securityBusiness) {
        throw new GraphQLError(`Business ID="${businessId}" is not a security`);
      }

      const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      const { executions, transactionByExecutionId } = await injector
        .get(ForeignSecuritiesProvider)
        .getSecurityBusinessHistory(businessId, ownerId);

      return {
        id: businessId,
        security: securityBusiness,
        position: { id: businessId, ...calculateSecurityPosition(executions) },
        executions: executions.map(execution => ({
          id: execution.id,
          execution,
          transaction: transactionByExecutionId.get(execution.id) ?? null,
        })),
      };
    },
  },
  SecurityHistoryExecution: {
    id: historyExecution => historyExecution.id,
    execution: historyExecution => historyExecution.execution,
    // Transaction concrete types are mapped to their id (see codegen.ts mappers); Charge is
    // mapped to its row, so it has to be loaded.
    transaction: historyExecution => historyExecution.transaction?.id ?? null,
    charge: async (historyExecution, _, { injector }) => {
      const chargeId = historyExecution.transaction?.charge_id;
      if (!chargeId) {
        return null;
      }
      return (await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId)) ?? null;
    },
  },
  SecurityPosition: {
    id: position => position.id,
    quantity: position => position.quantity,
    // A security with no ingested executions has no currency to report an amount in, and
    // `formatFinancialAmount` would fall back to the local one — turning "nothing is known"
    // into a confident ILS 0. Null is the honest answer; the client renders it as an em dash.
    averageCost: position => positionAmount(position.averageCost, position.currency),
    totalBought: position => positionAmount(position.totalBought, position.currency),
    totalSold: position => positionAmount(position.totalSold, position.currency),
    historyStartDate: position => position.historyStartDate,
    lastExecutionDate: position => position.lastExecutionDate,
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
