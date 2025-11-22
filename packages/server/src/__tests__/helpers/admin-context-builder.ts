import type { PoolClient } from 'pg';
import type { AdminContext } from '../../plugins/admin-context-plugin.js';
import { qualifyTable } from './test-db-config.js';

/**
 * Builds AdminContext from database user_context table.
 * 
 * This helper eliminates ~100 lines of duplication across integration tests
 * by querying the database for the full admin context configuration.
 * 
 * @param client - Database client connection
 * @param businessName - Name of the admin business entity (default: 'Admin Business')
 * @returns Complete AdminContext object with all required fields populated from DB
 * 
 * @example
 * ```typescript
 * const client = await pool.connect();
 * try {
 *   const adminContext = await buildAdminContextFromDb(client);
 *   // Use adminContext in test...
 * } finally {
 *   client.release();
 * }
 * ```
 */
export async function buildAdminContextFromDb(
  client: PoolClient,
  businessName: string = 'Admin Business'
): Promise<AdminContext> {
  const contextResult = await client.query(
    `SELECT uc.* FROM ${qualifyTable('user_context')} uc
     JOIN ${qualifyTable('financial_entities')} fe ON fe.id = uc.owner_id
     WHERE fe.name = $1 AND fe.type = $2
     LIMIT 1`,
    [businessName, 'business']
  );

  if (contextResult.rows.length === 0) {
    throw new Error(
      `Admin context not found for business "${businessName}". ` +
      `Ensure seedAdminCore() has been called before tests.`
    );
  }

  const dbContext = contextResult.rows[0];
  const adminBusinessId = dbContext.owner_id as string;

  return {
    defaultLocalCurrency: dbContext.default_local_currency,
    defaultCryptoConversionFiatCurrency: dbContext.default_fiat_currency_for_crypto_conversions,
    defaultAdminBusinessId: adminBusinessId,
    defaultTaxCategoryId: dbContext.default_tax_category_id,
    locality: dbContext.locality || 'Israel',
    ledgerLock: dbContext.ledger_lock 
      ? dbContext.ledger_lock.toISOString().split('T')[0] 
      : undefined,
    authorities: {
      vatBusinessId: dbContext.vat_business_id,
      inputVatTaxCategoryId: dbContext.input_vat_tax_category_id,
      outputVatTaxCategoryId: dbContext.output_vat_tax_category_id,
      taxBusinessId: dbContext.tax_business_id,
      taxExpensesTaxCategoryId: dbContext.tax_expenses_tax_category_id,
      socialSecurityBusinessId: dbContext.social_security_business_id,
      vatReportExcludedBusinessNames: [],
    },
    general: {
      taxCategories: {
        exchangeRateTaxCategoryId: dbContext.exchange_rate_tax_category_id,
        incomeExchangeRateTaxCategoryId: dbContext.income_exchange_rate_tax_category_id,
        exchangeRevaluationTaxCategoryId: dbContext.exchange_rate_revaluation_tax_category_id,
        feeTaxCategoryId: dbContext.fee_tax_category_id,
        generalFeeTaxCategoryId: dbContext.general_fee_tax_category_id,
        fineTaxCategoryId: dbContext.fine_tax_category_id,
        untaxableGiftsTaxCategoryId: dbContext.untaxable_gifts_tax_category_id,
        balanceCancellationTaxCategoryId: dbContext.balance_cancellation_tax_category_id,
        developmentForeignTaxCategoryId: dbContext.development_foreign_tax_category_id,
        developmentLocalTaxCategoryId: dbContext.development_local_tax_category_id,
        salaryExcessExpensesTaxCategoryId: dbContext.salary_excess_expenses_tax_category_id,
      },
    },
    crossYear: {
      expensesToPayTaxCategoryId: dbContext.expenses_to_pay_tax_category_id,
      expensesInAdvanceTaxCategoryId: dbContext.expenses_in_advance_tax_category_id,
      incomeToCollectTaxCategoryId: dbContext.income_to_collect_tax_category_id,
      incomeInAdvanceTaxCategoryId: dbContext.income_in_advance_tax_category_id,
    },
    financialAccounts: {
      poalimBusinessId: null,
      discountBusinessId: null,
      swiftBusinessId: null,
      isracardBusinessId: null,
      amexBusinessId: null,
      calBusinessId: null,
      etanaBusinessId: null,
      krakenBusinessId: null,
      etherScanBusinessId: null,
      foreignSecuritiesBusinessId: null,
      bankAccountIds: [],
      creditCardIds: [],
      internalWalletsIds: [],
    },
    bankDeposits: { 
      bankDepositBusinessId: null, 
      bankDepositInterestIncomeTaxCategoryId: null 
    },
    foreignSecurities: { 
      foreignSecuritiesBusinessId: null, 
      foreignSecuritiesFeesCategoryId: null 
    },
    salaries: {
      zkufotExpensesTaxCategoryId: null,
      zkufotIncomeTaxCategoryId: null,
      socialSecurityExpensesTaxCategoryId: null,
      salaryExpensesTaxCategoryId: null,
      trainingFundExpensesTaxCategoryId: null,
      compensationFundExpensesTaxCategoryId: null,
      pensionExpensesTaxCategoryId: null,
      batchedEmployeesBusinessId: null,
      batchedFundsBusinessId: null,
      salaryBatchedBusinessIds: [],
      taxDeductionsBusinessId: null,
      recoveryReserveExpensesTaxCategoryId: null,
      recoveryReserveTaxCategoryId: null,
      vacationReserveExpensesTaxCategoryId: null,
      vacationReserveTaxCategoryId: null,
    },
    businessTrips: { 
      businessTripTaxCategoryId: null, 
      businessTripTagId: null 
    },
    dividends: {
      dividendWithholdingTaxBusinessId: null,
      dividendTaxCategoryId: null,
      dividendPaymentBusinessIds: [],
      dividendBusinessIds: [],
    },
    depreciation: {
      accumulatedDepreciationTaxCategoryId: null,
      rndDepreciationExpensesTaxCategoryId: null,
      gnmDepreciationExpensesTaxCategoryId: null,
      marketingDepreciationExpensesTaxCategoryId: null,
    },
  };
}
