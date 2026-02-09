import { describe, expect, it } from 'vitest';
import { BusinessesProvider } from '../modules/financial-entities/providers/businesses.provider.js';
import { DocumentsProvider } from '../modules/documents/providers/documents.provider.js';
import { IssuedDocumentsProvider } from '../modules/documents/providers/issued-documents.provider.js';
import { DividendsProvider } from '../modules/dividends/providers/dividends.provider.js';
import { DynamicReportProvider } from '../modules/reports/providers/dynamic-report.provider.js';
import { VatReportProvider } from '../modules/reports/providers/vat-report.provider.js';
import { MiscExpensesProvider } from '../modules/misc-expenses/providers/misc-expenses.provider.js';
import { CorporateTaxesProvider } from '../modules/corporate-taxes/providers/corporate-taxes.provider.js';
import { FinancialEntitiesProvider } from '../modules/financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../modules/financial-entities/providers/tax-categories.provider.js';
import { TransactionsProvider } from '../modules/transactions/providers/transactions.provider.js';
import { FinancialAccountsProvider } from '../modules/financial-accounts/providers/financial-accounts.provider.js';
import { FinancialBankAccountsProvider } from '../modules/financial-accounts/providers/financial-bank-accounts.provider.js';
import { ClientsProvider } from '../modules/financial-entities/providers/clients.provider.js';
import { AdminBusinessesProvider } from '../modules/financial-entities/providers/admin-businesses.provider.js';
import { TagsProvider } from '../modules/tags/providers/tags.provider.js';
import { ChargeTagsProvider } from '../modules/tags/providers/charge-tags.provider.js';
import { DeelInvoicesProvider } from '../modules/deel/providers/deel-invoices.provider.js';
import { ChargesProvider } from '../modules/charges/providers/charges.provider.js';
import { GreenInvoiceClientProvider } from '../modules/app-providers/green-invoice-client.js';
import { CryptoExchangeProvider } from '../modules/exchange-rates/providers/crypto-exchange.provider.js';
import { LedgerProvider } from '../modules/ledger/providers/ledger.provider.js';
import { BusinessTripExpensesProvider } from '../modules/business-trips/providers/business-trips-expenses.provider.js';
import { BusinessTripCarRentalExpensesProvider } from '../modules/business-trips/providers/business-trips-expenses-car-rental.provider.js';
import { BusinessTripOtherExpensesProvider } from '../modules/business-trips/providers/business-trips-expenses-other.provider.js';
import { BusinessTripTravelAndSubsistenceExpensesProvider } from '../modules/business-trips/providers/business-trips-expenses-travel-and-subsistence.provider.js';
import { BusinessTripExpensesTransactionsMatchProvider } from '../modules/business-trips/providers/business-trips-expenses-transactions-match.provider.js';
import { BusinessTripFlightsExpensesProvider } from '../modules/business-trips/providers/business-trips-expenses-flights.provider.js';
import { BusinessTripAccommodationsExpensesProvider } from '../modules/business-trips/providers/business-trips-expenses-accommodations.provider.js';
import { BusinessTripEmployeePaymentsProvider } from '../modules/business-trips/providers/business-trips-employee-payments.provider.js';
import { BusinessTripAttendeesProvider } from '../modules/business-trips/providers/business-trips-attendees.provider.js';
import { BusinessTripsProvider } from '../modules/business-trips/providers/business-trips.provider.js';
import { AnnualRevenueReportProvider } from '../modules/reports/providers/annual-revenue-report.provider.js';
import { BalanceReportProvider } from '../modules/reports/providers/balance-report.provider.js';
import { BankDepositChargesProvider } from '../modules/bank-deposits/providers/bank-deposit-charges.provider.js';
import { ChargeSpreadProvider } from '../modules/charges/providers/charge-spread.provider.js';
import { DeelContractsProvider } from '../modules/deel/providers/deel-contracts.provider.js';
import { BalanceCancellationProvider } from '../modules/ledger/providers/balance-cancellation.provider.js';
import { UnbalancedBusinessesProvider } from '../modules/ledger/providers/unbalanced-businesses.provider.js';
import { EmployeesProvider } from '../modules/salaries/providers/employees.provider.js';
import { FundsProvider } from '../modules/salaries/providers/funds.provider.js';
import { SalariesProvider } from '../modules/salaries/providers/salaries.provider.js';
import { CreditCardTransactionsProvider } from '../modules/transactions/providers/creditcard-transactions.provider.js';

describe('Cache Isolation Integration', () => {
  // We expect these providers to be Operation scoped now because they carry tenant data
  const tenantProviders = [
      BusinessesProvider,
      DocumentsProvider,
      IssuedDocumentsProvider,
      DividendsProvider,
      DynamicReportProvider,
      VatReportProvider,
      MiscExpensesProvider,
      CorporateTaxesProvider,
      FinancialEntitiesProvider,
      TaxCategoriesProvider,
      TransactionsProvider,
      CreditCardTransactionsProvider,
      FinancialAccountsProvider,
      FinancialBankAccountsProvider,
      ClientsProvider,
      AdminBusinessesProvider,
      TagsProvider,
      ChargeTagsProvider,
      DeelInvoicesProvider,
      DeelContractsProvider,
      ChargesProvider,
      ChargeSpreadProvider,
      GreenInvoiceClientProvider,
      CryptoExchangeProvider,
      LedgerProvider,
      AnnualRevenueReportProvider,
      BalanceReportProvider,
      BankDepositChargesProvider,
      BusinessTripAttendeesProvider,
      BusinessTripEmployeePaymentsProvider,
      BusinessTripAccommodationsExpensesProvider,
      BusinessTripCarRentalExpensesProvider,
      BusinessTripFlightsExpensesProvider,
      BusinessTripOtherExpensesProvider,
      BusinessTripExpensesTransactionsMatchProvider,
      BusinessTripTravelAndSubsistenceExpensesProvider,
      BusinessTripExpensesProvider,
      BusinessTripsProvider,
      BalanceCancellationProvider,
      UnbalancedBusinessesProvider,
      EmployeesProvider,
      FundsProvider,
      SalariesProvider,
  ];

  it.each(tenantProviders)('should reflect Operation Scope by creating unique loader instances', (Provider) => {
      // Mock dependencies. Most providers expect 1-2 args now (DB + maybe Auth/Context)
      // We pass enough mocks to satisfy internal optional usage if constructor runs logic
      const mockContext = { 
          adminContext: { 
              defaultLocalCurrency: 'ILS', 
              defaultCryptoConversionFiatCurrency: 'USD' 
          } 
      };
      const mockDeps = [mockContext, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}]; 
      
      // Instantiate twice
      const instance1 = new (Provider as any)(...mockDeps);
      const instance2 = new (Provider as any)(...mockDeps);

      // 1. Verify no global "cache" property (it was removed in favor of per-instance behavior)
      expect(instance1).not.toHaveProperty('cache'); 
      
      // 2. Find any property ending in 'Loader'
      const loaderKey = Object.keys(instance1).find(k => k.endsWith('Loader'));
      
      if (loaderKey) {
          const loader1 = (instance1 as any)[loaderKey];
          const loader2 = (instance2 as any)[loaderKey];
          
          expect(loader1).toBeDefined();
          expect(loader2).toBeDefined();
          // Critical check: Loaders must be different references
          expect(loader1).not.toBe(loader2); 
      }
  });
});
