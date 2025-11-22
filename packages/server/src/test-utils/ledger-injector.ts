import type { Injector } from 'graphql-modules';
import type { Pool } from 'pg';
import { CoinMarketCapProvider } from '@modules/app-providers/coinmarketcap.js';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { BusinessTripsProvider } from '@modules/business-trips/providers/business-trips.provider.js';
import { ChargeSpreadProvider } from '@modules/charges/providers/charge-spread.provider.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { CryptoExchangeProvider } from '@modules/exchange-rates/providers/crypto-exchange.provider.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FiatExchangeProvider } from '@modules/exchange-rates/providers/fiat-exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { BusinessesOperationProvider } from '@modules/financial-entities/providers/businesses-operation.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { BalanceCancellationProvider } from '@modules/ledger/providers/balance-cancellation.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { UnbalancedBusinessesProvider } from '@modules/ledger/providers/unbalanced-businesses.provider.js';
import { MiscExpensesProvider } from '@modules/misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { VatProvider } from '@modules/vat/providers/vat.provider.js';
import type { AdminContext } from '../plugins/admin-context-plugin.js';

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

export function createLedgerTestContext(options: {
  pool: Pool;
  adminContext: AdminContext;
  moduleId?: string;
  env?: unknown;
  currentUser?: unknown;
}): ModuleContextLike {
  const { pool, adminContext, moduleId = 'test', env, currentUser } = options;

  const dbProvider = new DBProvider(pool);

  // placeholder for context; filled after injector is created
  const contextRef: { current?: ModuleContextLike } = {};

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
          dbProvider,
          new CoinMarketCapProvider(),
        );
      case ExchangeProvider: {
        const crypto = new CryptoExchangeProvider(
          contextRef.current as unknown as GraphQLModules.Context,
          dbProvider,
          new CoinMarketCapProvider(),
        );
        const fiat = new FiatExchangeProvider(dbProvider);
        return new ExchangeProvider(
          contextRef.current as unknown as GraphQLModules.Context,
          crypto,
          fiat,
        );
      }
      case LedgerProvider:
        return new LedgerProvider(
          contextRef.current as unknown as GraphQLModules.Context,
          dbProvider,
        );
      case UnbalancedBusinessesProvider:
        return new UnbalancedBusinessesProvider(dbProvider);
      case BalanceCancellationProvider:
        return new BalanceCancellationProvider(dbProvider);
      case MiscExpensesProvider:
        return new MiscExpensesProvider(dbProvider);
      case DocumentsProvider:
        return new DocumentsProvider(dbProvider);
      case TransactionsProvider:
        return new TransactionsProvider(dbProvider);
      case BusinessesProvider:
        return new BusinessesProvider(dbProvider);
      case FinancialAccountsProvider:
        return new FinancialAccountsProvider(dbProvider);
      case TaxCategoriesProvider:
        return new TaxCategoriesProvider(dbProvider);
      case ChargesProvider:
        return new ChargesProvider(dbProvider);
      case VatProvider:
        return new VatProvider(dbProvider);
      case FinancialEntitiesProvider: {
        const businessesProvider = new BusinessesProvider(dbProvider);
        const taxCategoriesProvider = new TaxCategoriesProvider(dbProvider);
        const businessesOperationStub: Pick<BusinessesOperationProvider, 'deleteBusinessById'> = {
          deleteBusinessById: async (_businessId: string) => {},
        };
        return new FinancialEntitiesProvider(
          dbProvider,
          businessesProvider,
          businessesOperationStub as unknown as BusinessesOperationProvider,
          taxCategoriesProvider,
        );
      }
      case BusinessTripsProvider:
        return new BusinessTripsProvider(dbProvider);
      case ChargeSpreadProvider:
        return new ChargeSpreadProvider(dbProvider);
      default:
        throw new Error(
          `Unsupported provider requested by injector: ${
            (token as { name?: string })?.name ?? String(token)
          }`,
        );
    }
  });

  const context: ModuleContextLike = {
    injector,
    adminContext,
    moduleId,
    env,
    currentUser,
  };
  contextRef.current = context;
  return context;
}
