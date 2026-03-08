import { Currency } from '../../shared/enums.js';
import type { TimelessDateString } from '../../shared/types/index.js';

export type * from './__generated__/types.js';
export type * from './__generated__/admin-context.types.js';

export type AdminContext = {
  defaultLocalCurrency: Currency;
  defaultCryptoConversionFiatCurrency: Currency;
  ownerId: string;
  defaultTaxCategoryId: string;
  locality: string;
  ledgerLock?: TimelessDateString;
  authorities: {
    vatBusinessId: string;
    inputVatTaxCategoryId: string;
    outputVatTaxCategoryId: string;
    propertyOutputVatTaxCategoryId: string | null;
    taxBusinessId: string;
    taxExpensesTaxCategoryId: string;
    socialSecurityBusinessId: string;
    vatReportExcludedBusinessNames: string[];
  };
  general: {
    taxCategories: {
      exchangeRateTaxCategoryId: string;
      incomeExchangeRateTaxCategoryId: string;
      exchangeRevaluationTaxCategoryId: string;
      feeTaxCategoryId: string;
      generalFeeTaxCategoryId: string;
      fineTaxCategoryId: string;
      untaxableGiftsTaxCategoryId: string;
      balanceCancellationTaxCategoryId: string;
      developmentForeignTaxCategoryId: string;
      developmentLocalTaxCategoryId: string;
      salaryExcessExpensesTaxCategoryId: string;
    };
  };
  crossYear: {
    expensesToPayTaxCategoryId: string;
    expensesInAdvanceTaxCategoryId: string;
    incomeToCollectTaxCategoryId: string;
    incomeInAdvanceTaxCategoryId: string;
  };
  financialAccounts: {
    poalimBusinessId: string | null;
    discountBusinessId: string | null;
    swiftBusinessId: string | null;
    isracardBusinessId: string | null;
    amexBusinessId: string | null;
    calBusinessId: string | null;
    etanaBusinessId: string | null;
    krakenBusinessId: string | null;
    etherScanBusinessId: string | null;
    foreignSecuritiesBusinessId: string | null;
    bankAccountIds: string[];
    creditCardIds: string[];
    internalWalletsIds: string[];
  };
  bankDeposits: {
    bankDepositBusinessId: string | null;
    bankDepositInterestIncomeTaxCategoryId: string | null;
  };

  foreignSecurities: {
    foreignSecuritiesBusinessId: string | null;
    foreignSecuritiesFeesCategoryId: string | null;
  };
  salaries: {
    zkufotExpensesTaxCategoryId: string | null;
    zkufotIncomeTaxCategoryId: string | null;
    socialSecurityExpensesTaxCategoryId: string | null;
    salaryExpensesTaxCategoryId: string | null;
    trainingFundExpensesTaxCategoryId: string | null;
    compensationFundExpensesTaxCategoryId: string | null;
    pensionExpensesTaxCategoryId: string | null;
    batchedEmployeesBusinessId: string | null;
    batchedFundsBusinessId: string | null;
    salaryBatchedBusinessIds: string[];
    taxDeductionsBusinessId: string | null;
    recoveryReserveExpensesTaxCategoryId: string | null;
    recoveryReserveTaxCategoryId: string | null;
    vacationReserveExpensesTaxCategoryId: string | null;
    vacationReserveTaxCategoryId: string | null;
  };
  businessTrips: {
    businessTripTaxCategoryId: string | null;
    businessTripTagId: string | null;
  };
  dividends: {
    dividendWithholdingTaxBusinessId: string | null;
    dividendTaxCategoryId: string | null;
    dividendPaymentBusinessIds: string[];
    dividendBusinessIds: string[];
  };
  depreciation: {
    accumulatedDepreciationTaxCategoryId: string | null;
    rndDepreciationExpensesTaxCategoryId: string | null;
    gnmDepreciationExpensesTaxCategoryId: string | null;
    marketingDepreciationExpensesTaxCategoryId: string | null;
  };
};
