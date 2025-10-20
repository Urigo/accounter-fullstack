import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IGetAdminContextsQuery,
  IUpdateAdminContextParams,
  IUpdateAdminContextQuery,
} from '../types.js';

const getAdminContexts = sql<IGetAdminContextsQuery>`
  SELECT *
  FROM accounter_schema.user_context
  WHERE owner_id IN $$ownerIds;
`;

const updateAdminContext = sql<IUpdateAdminContextQuery>`
  UPDATE accounter_schema.user_context
  SET
    default_local_currency = COALESCE(
      $defaultLocalCurrency,
      default_local_currency
    ),
    default_fiat_currency_for_crypto_conversions = COALESCE(
      $defaultFiatCurrencyForCryptoConversions,
      default_fiat_currency_for_crypto_conversions
    ),
    default_tax_category_id = COALESCE(
      $defaultTaxCategoryId,
      default_tax_category_id
    ),
    vat_business_id = COALESCE(
      $vatBusinessId,
      vat_business_id
    ),
    input_vat_tax_category_id = COALESCE(
      $inputVatTaxCategoryId,
      input_vat_tax_category_id
    ),
    output_vat_tax_category_id = COALESCE(
      $outputVatTaxCategoryId,
      output_vat_tax_category_id
    ),
    tax_business_id = COALESCE(
      $taxBusinessId,
      tax_business_id
    ),
    tax_expenses_tax_category_id = COALESCE(
      $taxExpensesTaxCategoryId,
      tax_expenses_tax_category_id
    ),
    social_security_business_id = COALESCE(
      $socialSecurityBusinessId,
      social_security_business_id
    ),
    exchange_rate_tax_category_id = COALESCE(
      $exchangeRateTaxCategoryId,
      exchange_rate_tax_category_id
    ),
    income_exchange_rate_tax_category_id = COALESCE(
      $incomeExchangeRateTaxCategoryId,
      income_exchange_rate_tax_category_id
    ),
    exchange_rate_revaluation_tax_category_id = COALESCE(
      $exchangeRateRevaluationTaxCategoryId,
      exchange_rate_revaluation_tax_category_id
    ),
    fee_tax_category_id = COALESCE(
      $feeTaxCategoryId,
      fee_tax_category_id
    ),
    general_fee_tax_category_id = COALESCE(
      $generalFeeTaxCategoryId,
      general_fee_tax_category_id
    ),
    fine_tax_category_id = COALESCE(
      $fineTaxCategoryId,
      fine_tax_category_id
    ),
    untaxable_gifts_tax_category_id = COALESCE(
      $untaxableGiftsTaxCategoryId,
      untaxable_gifts_tax_category_id
    ),
    balance_cancellation_tax_category_id = COALESCE(
      $balanceCancellationTaxCategoryId,
      balance_cancellation_tax_category_id
    ),
    development_foreign_tax_category_id = COALESCE(
      $developmentForeignTaxCategoryId,
      development_foreign_tax_category_id
    ),
    development_local_tax_category_id = COALESCE(
      $developmentLocalTaxCategoryId,
      development_local_tax_category_id
    ),
    accumulated_depreciation_tax_category_id = COALESCE(
      $accumulatedDepreciationTaxCategoryId,
      accumulated_depreciation_tax_category_id
    ),
    rnd_depreciation_expenses_tax_category_id = COALESCE(
      $rndDepreciationExpensesTaxCategoryId,
      rnd_depreciation_expenses_tax_category_id
    ),
    gnm_depreciation_expenses_tax_category_id = COALESCE(
      $gnmDepreciationExpensesTaxCategoryId,
      gnm_depreciation_expenses_tax_category_id
    ),
    marketing_depreciation_expenses_tax_category_id = COALESCE(
      $marketingDepreciationExpensesTaxCategoryId,
      marketing_depreciation_expenses_tax_category_id
    ),
    bank_deposit_interest_income_tax_category_id = COALESCE(
      $bankDepositInterestIncomeTaxCategoryId,
      bank_deposit_interest_income_tax_category_id
    ),
    business_trip_tax_category_id = COALESCE(
      $businessTripTaxCategoryId,
      business_trip_tax_category_id
    ),
    business_trip_tag_id = COALESCE(
      $businessTripTagId,
      business_trip_tag_id
    ),
    expenses_to_pay_tax_category_id = COALESCE(
      $expensesToPayTaxCategoryId,
      expenses_to_pay_tax_category_id
    ),
    expenses_in_advance_tax_category_id = COALESCE(
      $expensesInAdvanceTaxCategoryId,
      expenses_in_advance_tax_category_id
    ),
    income_to_collect_tax_category_id = COALESCE(
      $incomeToCollectTaxCategoryId,
      income_to_collect_tax_category_id
    ),
    income_in_advance_tax_category_id = COALESCE(
      $incomeInAdvanceTaxCategoryId,
      income_in_advance_tax_category_id
    ),
    zkufot_expenses_tax_category_id = COALESCE(
      $zkufotExpensesTaxCategoryId,
      zkufot_expenses_tax_category_id
    ),
    zkufot_income_tax_category_id = COALESCE(
      $zkufotIncomeTaxCategoryId,
      zkufot_income_tax_category_id
    ),
    social_security_expenses_tax_category_id = COALESCE(
      $socialSecurityExpensesTaxCategoryId,
      social_security_expenses_tax_category_id
    ),
    salary_expenses_tax_category_id = COALESCE(
      $salaryExpensesTaxCategoryId,
      salary_expenses_tax_category_id
    ),
    training_fund_expenses_tax_category_id = COALESCE(
      $trainingFundExpensesTaxCategoryId,
      training_fund_expenses_tax_category_id
    ),
    pension_fund_expenses_tax_category_id = COALESCE(
      $pensionFundExpensesTaxCategoryId,
      pension_fund_expenses_tax_category_id
    ),
    compensation_fund_expenses_tax_category_id = COALESCE(
      $compensationFundExpensesTaxCategoryId,
      compensation_fund_expenses_tax_category_id
    ),
    batched_employees_business_id = COALESCE(
      $batchedEmployeesBusinessId,
      batched_employees_business_id
    ),
    batched_funds_business_id = COALESCE(
      $batchedFundsBusinessId,
      batched_funds_business_id
    ),
    tax_deductions_business_id = COALESCE(
      $taxDeductionsBusinessId,
      tax_deductions_business_id
    ),
    recovery_reserve_expenses_tax_category_id = COALESCE(
      $recoveryReserveExpensesTaxCategoryId,
      recovery_reserve_expenses_tax_category_id
    ),
    recovery_reserve_tax_category_id = COALESCE(
      $recoveryReserveTaxCategoryId,
      recovery_reserve_tax_category_id
    ),
    vacation_reserve_expenses_tax_category_id = COALESCE(
      $vacationReserveExpensesTaxCategoryId,
      vacation_reserve_expenses_tax_category_id
    ),
    vacation_reserve_tax_category_id = COALESCE(
      $vacationReserveTaxCategoryId,
      vacation_reserve_tax_category_id
    ),
    poalim_business_id = COALESCE(
      $poalimBusinessId,
      poalim_business_id
    ),
    discount_business_id = COALESCE(
      $discountBusinessId,
      discount_business_id
    ),
    isracard_business_id = COALESCE(
      $isracardBusinessId,
      isracard_business_id
    ),
    amex_business_id = COALESCE(
      $amexBusinessId,
      amex_business_id
    ),
    cal_business_id = COALESCE(
      $calBusinessId,
      cal_business_id
    ),
    etana_business_id = COALESCE(
      $etanaBusinessId,
      etana_business_id
    ),
    kraken_business_id = COALESCE(
      $krakenBusinessId,
      kraken_business_id
    ),
    etherscan_business_id = COALESCE(
      $etherscanBusinessId,
      etherscan_business_id
    ),
    swift_business_id = COALESCE(
      $swiftBusinessId,
      swift_business_id
    ),
    bank_deposit_business_id = COALESCE(
      $bankDepositBusinessId,
      bank_deposit_business_id
    ),
    dividend_withholding_tax_business_id = COALESCE(
      $dividendWithholdingTaxBusinessId,
      dividend_withholding_tax_business_id
    ),
    dividend_tax_category_id = COALESCE(
      $dividendTaxCategoryId,
      dividend_tax_category_id
    ),
    salary_excess_expenses_tax_category_id = COALESCE(
      $salaryExcessExpensesTaxCategoryId,
      salary_excess_expenses_tax_category_id
    ),
    ledger_lock = COALESCE(
      $ledgerLock,
      ledger_lock
    ),
    foreign_securities_business_id = COALESCE(
      $foreignSecuritiesBusinessId,
      foreign_securities_business_id
    ),
    foreign_securities_fees_category_id = COALESCE(
      $foreignSecuritiesFeesCategoryId,
      foreign_securities_fees_category_id
    ),
    locality = COALESCE(
      $locality,
      locality
    )
  WHERE owner_id = $ownerId
  RETURNING *;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class AdminContextProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchAdminContextByID(ownerIds: readonly string[]) {
    const contexts = await getAdminContexts.run({ ownerIds }, this.dbProvider);
    return ownerIds.map(id => contexts.find(context => context.owner_id === id));
  }

  public getAdminContextLoader = new DataLoader(
    (ids: readonly string[]) => this.batchAdminContextByID(ids),
    {
      cacheKeyFn: id => `admin-context-${id}`,
      cacheMap: this.cache,
    },
  );

  public updateAdminContext(params: IUpdateAdminContextParams) {
    if (params.ownerId) {
      this.getAdminContextLoader.clear(params.ownerId);
    }
    return updateAdminContext.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
