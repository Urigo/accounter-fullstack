import { useExtendContext } from 'graphql-yoga';
import pg from 'pg';
import { sql } from '@pgtyped/runtime';
import type { Currency } from '@shared/enums';
import { formatCurrency, getCacheInstance } from '@shared/helpers';
import type { Environment } from '@shared/types';
import { env } from '../environment.js';
import type {
  IGetAdminBusinessContextQuery,
  IGetAdminBusinessContextResult,
} from './__generated__/admin-context-plugin.types.js';
import type { UserType } from './auth-plugin.js';

const getAdminBusinessContext = sql<IGetAdminBusinessContextQuery>`
  SELECT *
  FROM accounter_schema.user_context
  WHERE owner_id = $adminBusinessId`;

export type AdminContext = {
  defaultLocalCurrency: Currency;
  defaultCryptoConversionFiatCurrency: Currency;
  defaultAdminBusinessId: string;
  defaultTaxCategoryId: string;
  authorities: {
    vatBusinessId: string;
    inputVatTaxCategoryId: string;
    outputVatTaxCategoryId: string;
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
    };
  };
  crossYear: {
    expensesToPayTaxCategoryId: string;
    expensesInAdvanceTaxCategoryId: string;
    incomeToCollectTaxCategoryId: string;
    incomeInAdvanceTaxCategoryId: string | null;
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
    bankAccountIds: string[];
    creditCardIds: string[];
    internalWalletsIds: string[];
  };
  bankDeposits: {
    bankDepositBusinessId: string | null;
    bankDepositInterestIncomeTaxCategoryId: string | null;
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

const cache = getCacheInstance({
  stdTTL: 60,
});

async function fetchContext(adminBusinessId: string) {
  const context = cache.get<IGetAdminBusinessContextResult>(adminBusinessId);
  if (context) {
    return context;
  }

  const client = new pg.Client({
    user: env.postgres.user,
    password: env.postgres.password,
    host: env.postgres.host,
    port: Number(env.postgres.port),
    database: env.postgres.db,
    ssl: env.postgres.ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const [context] = await getAdminBusinessContext.run({ adminBusinessId }, client);
    if (!context) {
      throw new Error('Admin business context not found');
    }
    cache.set(adminBusinessId, context);

    return context;
  } catch (error) {
    console.error('Error fetching context:', error);
    throw 'Error fetching admin context';
  } finally {
    await client.end();
  }
}

function normalizeContext(rawContext: IGetAdminBusinessContextResult): AdminContext {
  const dividendPaymentBusinessIds = [
    '4bcca705-5b47-41c5-ba26-1e42c69cbf0d', // Uri Dividend
    '909fbe3c-0419-44ed-817d-ab774e93748a', // Dotan Dividend
    // TODO: fetch those IDs from DB somehow
  ];
  const bankAccountIds = [rawContext.poalim_business_id, rawContext.discount_business_id].filter(
    Boolean,
  ) as string[];
  const creditCardIds = [
    rawContext.isracard_business_id,
    rawContext.amex_business_id,
    rawContext.cal_business_id,
  ].filter(Boolean) as string[];
  const salaryBatchedBusinessIds = [
    rawContext.batched_employees_business_id,
    rawContext.batched_funds_business_id,
  ].filter(Boolean) as string[];
  const vatReportExcludedBusinessNames = [
    rawContext.vat_business_id,
    rawContext.tax_business_id,
    rawContext.social_security_business_id,
  ];
  return {
    defaultLocalCurrency: formatCurrency(rawContext.default_local_currency),
    defaultCryptoConversionFiatCurrency: formatCurrency(
      rawContext.default_fiat_currency_for_crypto_conversions,
    ),
    defaultAdminBusinessId: rawContext.owner_id,
    defaultTaxCategoryId: rawContext.default_tax_category_id,

    authorities: {
      vatBusinessId: rawContext.vat_business_id,
      inputVatTaxCategoryId: rawContext.input_vat_tax_category_id,
      outputVatTaxCategoryId: rawContext.output_vat_tax_category_id,
      taxBusinessId: rawContext.tax_business_id,
      taxExpensesTaxCategoryId: rawContext.tax_expenses_tax_category_id,
      socialSecurityBusinessId: rawContext.social_security_business_id,
      vatReportExcludedBusinessNames,
    },
    depreciation: {
      accumulatedDepreciationTaxCategoryId: rawContext.accumulated_depreciation_tax_category_id,
      rndDepreciationExpensesTaxCategoryId: rawContext.rnd_depreciation_expenses_tax_category_id,
      gnmDepreciationExpensesTaxCategoryId: rawContext.gnm_depreciation_expenses_tax_category_id,
      marketingDepreciationExpensesTaxCategoryId:
        rawContext.marketing_depreciation_expenses_tax_category_id,
    },
    bankDeposits: {
      bankDepositBusinessId: rawContext.bank_deposit_business_id,
      bankDepositInterestIncomeTaxCategoryId:
        rawContext.bank_deposit_interest_income_tax_category_id,
    },
    dividends: {
      dividendWithholdingTaxBusinessId: rawContext.dividend_withholding_tax_business_id,
      dividendTaxCategoryId: rawContext.dividend_tax_category_id,
      dividendPaymentBusinessIds,
      dividendBusinessIds: [
        ...(rawContext.dividend_withholding_tax_business_id
          ? [rawContext.dividend_withholding_tax_business_id]
          : []),
        ...dividendPaymentBusinessIds,
      ],
    },
    businessTrips: {
      businessTripTaxCategoryId: rawContext.business_trip_tax_category_id,
      businessTripTagId: rawContext.business_trip_tag_id,
    },
    financialAccounts: {
      poalimBusinessId: rawContext.poalim_business_id,
      discountBusinessId: rawContext.discount_business_id,
      swiftBusinessId: rawContext.swift_business_id,
      isracardBusinessId: rawContext.isracard_business_id,
      amexBusinessId: rawContext.amex_business_id,
      calBusinessId: rawContext.cal_business_id,
      etanaBusinessId: rawContext.etana_business_id,
      krakenBusinessId: rawContext.kraken_business_id,
      etherScanBusinessId: rawContext.etherscan_business_id,
      bankAccountIds,
      creditCardIds,
      internalWalletsIds: [
        ...bankAccountIds,
        ...creditCardIds,
        rawContext.etana_business_id,
        rawContext.kraken_business_id,
        rawContext.etherscan_business_id,
      ].filter(Boolean) as string[],
    },
    salaries: {
      zkufotExpensesTaxCategoryId: rawContext.zkufot_expenses_tax_category_id,
      zkufotIncomeTaxCategoryId: rawContext.zkufot_income_tax_category_id,
      socialSecurityExpensesTaxCategoryId: rawContext.social_security_expenses_tax_category_id,
      salaryExpensesTaxCategoryId: rawContext.salary_expenses_tax_category_id,
      trainingFundExpensesTaxCategoryId: rawContext.training_fund_expenses_tax_category_id,
      compensationFundExpensesTaxCategoryId: rawContext.compensation_fund_expenses_tax_category_id,
      pensionExpensesTaxCategoryId: rawContext.pension_fund_expenses_tax_category_id,
      batchedEmployeesBusinessId: rawContext.batched_employees_business_id,
      batchedFundsBusinessId: rawContext.batched_funds_business_id,
      salaryBatchedBusinessIds,
      taxDeductionsBusinessId: rawContext.tax_deductions_business_id,
      recoveryReserveExpensesTaxCategoryId: rawContext.recovery_reserve_expenses_tax_category_id,
      recoveryReserveTaxCategoryId: rawContext.recovery_reserve_tax_category_id,
      vacationReserveExpensesTaxCategoryId: rawContext.vacation_reserve_expenses_tax_category_id,
      vacationReserveTaxCategoryId: rawContext.vacation_reserve_tax_category_id,
    },
    crossYear: {
      expensesToPayTaxCategoryId: rawContext.expenses_to_pay_tax_category_id,
      expensesInAdvanceTaxCategoryId: rawContext.expenses_in_advance_tax_category_id,
      incomeToCollectTaxCategoryId: rawContext.income_to_collect_tax_category_id,
      incomeInAdvanceTaxCategoryId: rawContext.default_tax_category_id,
    },
    general: {
      taxCategories: {
        exchangeRateTaxCategoryId: rawContext.exchange_rate_tax_category_id,
        incomeExchangeRateTaxCategoryId: rawContext.income_exchange_rate_tax_category_id,
        exchangeRevaluationTaxCategoryId: rawContext.exchange_rate_revaluation_tax_category_id,
        feeTaxCategoryId: rawContext.fee_tax_category_id,
        generalFeeTaxCategoryId: rawContext.general_fee_tax_category_id,
        fineTaxCategoryId: rawContext.fine_tax_category_id,
        untaxableGiftsTaxCategoryId: rawContext.untaxable_gifts_tax_category_id,
        balanceCancellationTaxCategoryId: rawContext.balance_cancellation_tax_category_id,
        developmentForeignTaxCategoryId: rawContext.development_foreign_tax_category_id,
        developmentLocalTaxCategoryId: rawContext.development_local_tax_category_id,
      },
    },
  };
}

export const adminContextPlugin = () =>
  useExtendContext(async (contextSoFar: { env: Environment; currentUser: UserType }) => {
    const rawContext = await fetchContext(contextSoFar.currentUser.userId);
    const adminContext = normalizeContext(rawContext);
    return {
      adminContext,
    };
  });
