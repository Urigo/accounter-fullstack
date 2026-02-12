import type { Injector } from 'graphql-modules';
import type { Pool } from 'pg';
import { CoinMarketCapProvider } from '../modules/app-providers/coinmarketcap.js';
import { DBProvider } from '../modules/app-providers/db.provider.js';
import { TenantAwareDBClient } from '../modules/app-providers/tenant-db-client.js';
import { BusinessTripsProvider } from '../modules/business-trips/providers/business-trips.provider.js';
import { ChargeSpreadProvider } from '../modules/charges/providers/charge-spread.provider.js';
import { ChargesProvider } from '../modules/charges/providers/charges.provider.js';
import { DocumentsProvider } from '../modules/documents/providers/documents.provider.js';
import { CryptoExchangeProvider } from '../modules/exchange-rates/providers/crypto-exchange.provider.js';
import { ExchangeProvider } from '../modules/exchange-rates/providers/exchange.provider.js';
import { FiatExchangeProvider } from '../modules/exchange-rates/providers/fiat-exchange.provider.js';
import { FinancialAccountsProvider } from '../modules/financial-accounts/providers/financial-accounts.provider.js';
import { BusinessesOperationProvider } from '../modules/financial-entities/providers/businesses-operation.provider.js';
import { BusinessesProvider } from '../modules/financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../modules/financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../modules/financial-entities/providers/tax-categories.provider.js';
import { BalanceCancellationProvider } from '../modules/ledger/providers/balance-cancellation.provider.js';
import { LedgerProvider } from '../modules/ledger/providers/ledger.provider.js';
import { UnbalancedBusinessesProvider } from '../modules/ledger/providers/unbalanced-businesses.provider.js';
import { MiscExpensesProvider } from '../modules/misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '../modules/transactions/providers/transactions.provider.js';
import { VatProvider } from '../modules/vat/providers/vat.provider.js';
import type { AdminContext } from '../plugins/admin-context-plugin.js';
import type { Currency } from '../shared/enums.js';
import type { AuthContext } from '../shared/types/auth.js';
import type { AccounterContext } from '../shared/types/index.js';

export type ModuleContextLike = {
  injector: Injector;
  adminContext: AdminContext;
  // Keep optional fields for compatibility with resolvers/helpers
  moduleId: string;
  env?: unknown;
  currentUser?: unknown;
};

class SimpleInjector implements Injector {
  private instances = new Map<unknown, unknown>();

  constructor(private factory: (token: unknown) => unknown) {}

  get<T>(token: unknown): T {
    if (this.instances.has(token)) return this.instances.get(token) as T;
    const instance = this.factory(token);
    this.instances.set(token, instance);
    return instance as T;
  }
}

export type ExchangeRateMockFn = (
  baseCurrency: Currency,
  quoteCurrency: Currency,
  date: Date,
) => Promise<number>;

export function createLedgerTestContext(options: {
  pool: Pool;
  adminContext: AdminContext;
  moduleId?: string;
  env?: unknown;
  currentUser?: unknown;
  /**
   * Optional mock function to override ExchangeProvider.getExchangeRates.
   * Use this to fix exchange rates for deterministic tests.
   * @see createMockExchangeRates, mockExchangeRate from __tests__/helpers/exchange-mock.ts
   */
  mockExchangeRates?: ExchangeRateMockFn;
}): ModuleContextLike {
  const { pool, adminContext, moduleId = 'test', env, currentUser, mockExchangeRates } = options;

  const dbProvider = new DBProvider(pool);

  // Common context object shared between injector and TenantAwareDBClient
  const context = {
    injector: undefined as unknown as Injector,
    adminContext,
    moduleId,
    env,
    currentUser,
  } as ModuleContextLike;

  const tenantAwareDB = new TenantAwareDBClient(
    dbProvider,
    {} as AuthContext,
    context as AccounterContext,
  );

  // placeholder for context; filled after injector is created
  const contextRef: { current?: ModuleContextLike } = { current: context };

  const injector = new SimpleInjector(token => {
    switch (token) {
      case DBProvider:
        return dbProvider;
      case CoinMarketCapProvider:
        return new CoinMarketCapProvider();
      case FiatExchangeProvider:
        return new FiatExchangeProvider(dbProvider);
      case CryptoExchangeProvider:
        return new CryptoExchangeProvider(
          contextRef.current as unknown as GraphQLModules.Context,
          tenantAwareDB,
          new CoinMarketCapProvider(),
        );
      case ExchangeProvider: {
        const crypto = new CryptoExchangeProvider(
          contextRef.current as unknown as GraphQLModules.Context,
          tenantAwareDB,
          new CoinMarketCapProvider(),
        );
        const fiat = new FiatExchangeProvider(dbProvider);
        const exchangeProvider = new ExchangeProvider(
          contextRef.current as unknown as GraphQLModules.Context,
          crypto,
          fiat,
        );
        // Apply mock if provided
        if (mockExchangeRates) {
          exchangeProvider.getExchangeRates = mockExchangeRates;
        }
        return exchangeProvider;
      }
      case LedgerProvider:
        return new LedgerProvider(
          contextRef.current as unknown as GraphQLModules.Context,
          tenantAwareDB,
        );
      case UnbalancedBusinessesProvider:
        return new UnbalancedBusinessesProvider(tenantAwareDB);
      case BalanceCancellationProvider:
        return new BalanceCancellationProvider(tenantAwareDB);
      case MiscExpensesProvider:
        return new MiscExpensesProvider(tenantAwareDB);
      case DocumentsProvider:
        return new DocumentsProvider(tenantAwareDB);
      case TransactionsProvider:
        return new TransactionsProvider(tenantAwareDB);
      case BusinessesProvider:
        return new BusinessesProvider(tenantAwareDB);
      case FinancialAccountsProvider:
        return new FinancialAccountsProvider(tenantAwareDB);
      case TaxCategoriesProvider:
        return new TaxCategoriesProvider(tenantAwareDB);
      case ChargesProvider:
        return new ChargesProvider(tenantAwareDB);
      case VatProvider:
        return new VatProvider(dbProvider);
      case FinancialEntitiesProvider: {
        const businessesProvider = new BusinessesProvider(tenantAwareDB);
        const taxCategoriesProvider = new TaxCategoriesProvider(tenantAwareDB);
        const businessesOperationStub: Pick<BusinessesOperationProvider, 'deleteBusinessById'> = {
          deleteBusinessById: async (_businessId: string) => {},
        };
        return new FinancialEntitiesProvider(
          tenantAwareDB,
          businessesProvider,
          businessesOperationStub as unknown as BusinessesOperationProvider,
          taxCategoriesProvider,
        );
      }
      case BusinessTripsProvider:
        return new BusinessTripsProvider(dbProvider);
      case ChargeSpreadProvider:
        return new ChargeSpreadProvider(tenantAwareDB);
      default:
        throw new Error(
          `Unsupported provider requested by injector: ${
            (token as { name?: string })?.name ?? String(token)
          }`,
        );
    }
  });

  context.injector = injector;
  return context;
}
