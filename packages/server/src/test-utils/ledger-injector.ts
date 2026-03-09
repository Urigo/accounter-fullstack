import type { Injector } from 'graphql-modules';
import type { Pool } from 'pg';
import { AdminContextProvider } from '../modules/admin-context/providers/admin-context.provider.js';
import { CoinMarketCapProvider } from '../modules/app-providers/coinmarketcap.js';
import { DBProvider } from '../modules/app-providers/db.provider.js';
import { TenantAwareDBClient } from '../modules/app-providers/tenant-db-client.js';
import { AuthContextProvider } from '../modules/auth/providers/auth-context.provider.js';
import { BusinessTripsProvider } from '../modules/business-trips/providers/business-trips.provider.js';
import { ChargeSpreadProvider } from '../modules/charges/providers/charge-spread.provider.js';
import { ChargesAuthorizationProvider } from '../modules/charges/providers/charges-authorization.provider.js';
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
import type { Currency } from '../shared/enums.js';

export type ModuleContextLike = {
  injector: Injector;
  // Keep optional fields for compatibility with resolvers/helpers
  moduleId: string;
  env?: unknown;
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
  moduleId?: string;
  env?: unknown;
  /**
   * Optional authenticated tenant business id for tests.
   * Falls back to DEFAULT_FINANCIAL_ENTITY_ID for legacy tests.
   */
  businessId?: string;
  /**
   * Optional mock function to override ExchangeProvider.getExchangeRates.
   * Use this to fix exchange rates for deterministic tests.
   * @see createMockExchangeRates, mockExchangeRate from __tests__/helpers/exchange-mock.ts
   */
  mockExchangeRates?: ExchangeRateMockFn;
}): ModuleContextLike {
  const { pool, moduleId = 'test', env, businessId, mockExchangeRates } = options;

  const resolvedBusinessId = businessId ?? process.env.DEFAULT_FINANCIAL_ENTITY_ID;
  if (!resolvedBusinessId) {
    throw new Error(
      'createLedgerTestContext requires businessId or DEFAULT_FINANCIAL_ENTITY_ID for auth context',
    );
  }

  const dbProvider = new DBProvider(pool);

  // Common context object shared between injector and TenantAwareDBClient
  const context = {
    injector: undefined as unknown as Injector,
    moduleId,
    env,
  } as ModuleContextLike;

  // Create minimal AuthContextProvider for providers that need it
  const authContextProvider = {
    getAuthContext: async () => ({
      authType: null,
      tenant: { businessId: resolvedBusinessId },
    }),
  } as AuthContextProvider;

  const tenantAwareDB = new TenantAwareDBClient(dbProvider, authContextProvider);

  // Create AdminContextProvider for providers that need it
  const adminContextProvider = new AdminContextProvider(authContextProvider, tenantAwareDB);

  const injector = new SimpleInjector(token => {
    switch (token) {
      case DBProvider:
        return dbProvider;
      case AdminContextProvider:
        return adminContextProvider;
      case CoinMarketCapProvider:
        return new CoinMarketCapProvider();
      case FiatExchangeProvider:
        return new FiatExchangeProvider(dbProvider);
      case CryptoExchangeProvider:
        return new CryptoExchangeProvider(
          tenantAwareDB,
          adminContextProvider,
          new CoinMarketCapProvider(),
        );
      case ExchangeProvider: {
        const crypto = new CryptoExchangeProvider(
          tenantAwareDB,
          adminContextProvider,
          new CoinMarketCapProvider(),
        );
        const fiat = new FiatExchangeProvider(dbProvider);
        const exchangeProvider = new ExchangeProvider(crypto, fiat, adminContextProvider);
        // Apply mock if provided
        if (mockExchangeRates) {
          exchangeProvider.getExchangeRates = mockExchangeRates;
        }
        return exchangeProvider;
      }
      case LedgerProvider:
        return new LedgerProvider(tenantAwareDB, adminContextProvider);
      case UnbalancedBusinessesProvider:
        return new UnbalancedBusinessesProvider(tenantAwareDB, adminContextProvider);
      case BalanceCancellationProvider:
        return new BalanceCancellationProvider(tenantAwareDB);
      case MiscExpensesProvider:
        return new MiscExpensesProvider(tenantAwareDB, adminContextProvider);
      case DocumentsProvider:
        return new DocumentsProvider(tenantAwareDB, adminContextProvider);
      case TransactionsProvider:
        return new TransactionsProvider(tenantAwareDB);
      case BusinessesProvider:
        return new BusinessesProvider(tenantAwareDB, adminContextProvider);
      case FinancialAccountsProvider:
        return new FinancialAccountsProvider(tenantAwareDB, adminContextProvider);
      case TaxCategoriesProvider:
        return new TaxCategoriesProvider(tenantAwareDB, adminContextProvider);
      case ChargesProvider: {
        const chargesAuthorizationProvider = new ChargesAuthorizationProvider(
          authContextProvider,
          tenantAwareDB,
        );
        return new ChargesProvider(tenantAwareDB, chargesAuthorizationProvider);
      }
      case VatProvider:
        return new VatProvider(dbProvider);
      case FinancialEntitiesProvider: {
        const businessesProvider = new BusinessesProvider(tenantAwareDB, adminContextProvider);
        const taxCategoriesProvider = new TaxCategoriesProvider(
          tenantAwareDB,
          adminContextProvider,
        );
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
        return new BusinessTripsProvider(tenantAwareDB, adminContextProvider);
      case ChargeSpreadProvider:
        return new ChargeSpreadProvider(tenantAwareDB, adminContextProvider);
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
