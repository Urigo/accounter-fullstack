import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import {
  formatCurrency,
  optionalDateToTimelessDateString,
  resolveWriteTargetBusinessId,
} from '../../../shared/helpers/index.js';
import type { AuthContext } from '../../../shared/types/auth.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import type {
  AdminContext,
  IGetAdminContextsQuery,
  IGetAdminContextsResult,
  IUpdateAdminContextParams,
  IUpdateAdminContextQuery,
} from '../types.js';

// The per-role correlated subqueries below expose each admin_business_role group
// (see #3612) as an aggregated uuid[] column on the context row, so the runtime
// arrays (bank accounts, credit cards, internal wallets, dividend payments,
// VAT-excluded) are data-driven instead of enumerated from named columns/UUIDs.
const getAdminContexts = sql<IGetAdminContextsQuery>`
  SELECT
    uc.*,
    COALESCE((SELECT array_agg(r.business_id) FROM accounter_schema.admin_business_roles r WHERE r.owner_id = uc.owner_id AND r.role = 'BANK_ACCOUNT'), '{}'::uuid[]) AS bank_account_business_ids,
    COALESCE((SELECT array_agg(r.business_id) FROM accounter_schema.admin_business_roles r WHERE r.owner_id = uc.owner_id AND r.role = 'CREDIT_CARD'), '{}'::uuid[]) AS credit_card_business_ids,
    COALESCE((SELECT array_agg(r.business_id) FROM accounter_schema.admin_business_roles r WHERE r.owner_id = uc.owner_id AND r.role = 'CRYPTO_WALLET'), '{}'::uuid[]) AS crypto_wallet_business_ids,
    COALESCE((SELECT array_agg(r.business_id) FROM accounter_schema.admin_business_roles r WHERE r.owner_id = uc.owner_id AND r.role = 'DIVIDEND_PAYMENT'), '{}'::uuid[]) AS dividend_payment_business_ids,
    COALESCE((SELECT array_agg(r.business_id) FROM accounter_schema.admin_business_roles r WHERE r.owner_id = uc.owner_id AND r.role = 'VAT_EXCLUDED'), '{}'::uuid[]) AS vat_excluded_business_ids
  FROM accounter_schema.user_context uc
  WHERE uc.owner_id IN $$ownerIds;
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
    property_output_vat_tax_category_id = COALESCE(
      $propertyOutputVatTaxCategoryId,
      property_output_vat_tax_category_id
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
    otsar_hahayal_business_id = COALESCE(
      $otsarHahayalBusinessId,
      otsar_hahayal_business_id
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
    otsar_hahayal_credit_card_business_id = COALESCE(
      $otsarHahayalCreditCardBusinessId,
      otsar_hahayal_credit_card_business_id
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
    date_established = COALESCE(
      $dateEstablished,
      date_established
    ),
    initial_accounter_year = COALESCE(
      $initialAccounterYear,
      initial_accounter_year
    ),
    locality = COALESCE(
      $locality,
      locality
    )
  WHERE owner_id = $ownerId
  RETURNING
    user_context.*,
    COALESCE((SELECT array_agg(r.business_id) FROM accounter_schema.admin_business_roles r WHERE r.owner_id = user_context.owner_id AND r.role = 'BANK_ACCOUNT'), '{}'::uuid[]) AS bank_account_business_ids,
    COALESCE((SELECT array_agg(r.business_id) FROM accounter_schema.admin_business_roles r WHERE r.owner_id = user_context.owner_id AND r.role = 'CREDIT_CARD'), '{}'::uuid[]) AS credit_card_business_ids,
    COALESCE((SELECT array_agg(r.business_id) FROM accounter_schema.admin_business_roles r WHERE r.owner_id = user_context.owner_id AND r.role = 'CRYPTO_WALLET'), '{}'::uuid[]) AS crypto_wallet_business_ids,
    COALESCE((SELECT array_agg(r.business_id) FROM accounter_schema.admin_business_roles r WHERE r.owner_id = user_context.owner_id AND r.role = 'DIVIDEND_PAYMENT'), '{}'::uuid[]) AS dividend_payment_business_ids,
    COALESCE((SELECT array_agg(r.business_id) FROM accounter_schema.admin_business_roles r WHERE r.owner_id = user_context.owner_id AND r.role = 'VAT_EXCLUDED'), '{}'::uuid[]) AS vat_excluded_business_ids;
`;

/**
 * Legacy per-institution `updateAdminContext` inputs mapped to their abstract
 * {@link https://github.com/Urigo/accounter-fullstack/issues/3612 admin_business_role}.
 * This lets the deprecated typed mutation inputs (poalimBusinessId, …) keep
 * admin_business_roles in sync so the role-derived arrays reflect them. Phase 2
 * replaces these inputs with an abstract data-source API and removes this adapter.
 */
const PROVIDER_INPUT_ROLES: ReadonlyArray<[keyof IUpdateAdminContextParams, string]> = [
  ['poalimBusinessId', 'BANK_ACCOUNT'],
  ['discountBusinessId', 'BANK_ACCOUNT'],
  ['otsarHahayalBusinessId', 'BANK_ACCOUNT'],
  ['isracardBusinessId', 'CREDIT_CARD'],
  ['amexBusinessId', 'CREDIT_CARD'],
  ['calBusinessId', 'CREDIT_CARD'],
  ['otsarHahayalCreditCardBusinessId', 'CREDIT_CARD'],
  ['etanaBusinessId', 'CRYPTO_WALLET'],
  ['krakenBusinessId', 'CRYPTO_WALLET'],
  ['etherscanBusinessId', 'CRYPTO_WALLET'],
  ['vatBusinessId', 'VAT_EXCLUDED'],
  ['taxBusinessId', 'VAT_EXCLUDED'],
  ['socialSecurityBusinessId', 'VAT_EXCLUDED'],
];

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AdminContextProvider {
  private authContext: AuthContext | null = null;
  private authContextInitialized = false;
  private cachedContext: AdminContext | null = null;
  private cachedContextInitializing: Promise<AdminContext | null> | null = null;

  constructor(
    private authContextProvider: AuthContextProvider,
    private db: TenantAwareDBClient,
  ) {}

  public normalizeContext(rawContext: IGetAdminContextsResult): AdminContext {
    // Data-driven data-source / classification arrays, sourced from
    // admin_business_roles (see #3612) instead of hardcoded per-institution
    // columns or literal UUIDs. `toIdArray` is defensive against pgTyped's array
    // nullability and against callers (e.g. unit tests) that supply a row without
    // the aggregated columns.
    const toIdArray = (value: readonly (string | null)[] | null | undefined): string[] =>
      (value ?? []).filter((id): id is string => id != null);

    const bankAccountIds = toIdArray(rawContext.bank_account_business_ids);
    const creditCardIds = toIdArray(rawContext.credit_card_business_ids);
    const cryptoWalletIds = toIdArray(rawContext.crypto_wallet_business_ids);
    const dividendPaymentBusinessIds = toIdArray(rawContext.dividend_payment_business_ids);
    const vatReportExcludedBusinessNames = toIdArray(rawContext.vat_excluded_business_ids);
    const salaryBatchedBusinessIds = [
      rawContext.batched_employees_business_id,
      rawContext.batched_funds_business_id,
    ].filter(Boolean) as string[];
    // Internal wallets = every self-owned data source (banks + cards + crypto)
    // plus the foreign-securities business, de-duplicated.
    const internalWalletsIds = Array.from(
      new Set(
        [
          ...bankAccountIds,
          ...creditCardIds,
          ...cryptoWalletIds,
          rawContext.foreign_securities_business_id,
        ].filter(Boolean) as string[],
      ),
    );
    return {
      defaultLocalCurrency: formatCurrency(rawContext.default_local_currency),
      defaultCryptoConversionFiatCurrency: formatCurrency(
        rawContext.default_fiat_currency_for_crypto_conversions,
      ),
      ownerId: rawContext.owner_id,
      defaultTaxCategoryId: rawContext.default_tax_category_id,
      locality: rawContext.locality,
      ledgerLock: optionalDateToTimelessDateString(rawContext.ledger_lock) ?? undefined,
      dateEstablished: optionalDateToTimelessDateString(rawContext.date_established) ?? undefined,
      initialAccounterYear: rawContext.initial_accounter_year ?? undefined,

      authorities: {
        vatBusinessId: rawContext.vat_business_id,
        inputVatTaxCategoryId: rawContext.input_vat_tax_category_id,
        outputVatTaxCategoryId: rawContext.output_vat_tax_category_id,
        propertyOutputVatTaxCategoryId: rawContext.property_output_vat_tax_category_id,
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
      foreignSecurities: {
        foreignSecuritiesBusinessId: rawContext.foreign_securities_business_id,
        foreignSecuritiesFeesCategoryId: rawContext.foreign_securities_fees_category_id,
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
        otsarHahayalBusinessId: rawContext.otsar_hahayal_business_id,
        swiftBusinessId: rawContext.swift_business_id,
        isracardBusinessId: rawContext.isracard_business_id,
        amexBusinessId: rawContext.amex_business_id,
        calBusinessId: rawContext.cal_business_id,
        otsarHahayalCreditCardBusinessId: rawContext.otsar_hahayal_credit_card_business_id,
        etanaBusinessId: rawContext.etana_business_id,
        krakenBusinessId: rawContext.kraken_business_id,
        etherScanBusinessId: rawContext.etherscan_business_id,
        foreignSecuritiesBusinessId: rawContext.foreign_securities_business_id,
        bankAccountIds,
        creditCardIds,
        internalWalletsIds,
      },
      salaries: {
        zkufotExpensesTaxCategoryId: rawContext.zkufot_expenses_tax_category_id,
        zkufotIncomeTaxCategoryId: rawContext.zkufot_income_tax_category_id,
        socialSecurityExpensesTaxCategoryId: rawContext.social_security_expenses_tax_category_id,
        salaryExpensesTaxCategoryId: rawContext.salary_expenses_tax_category_id,
        trainingFundExpensesTaxCategoryId: rawContext.training_fund_expenses_tax_category_id,
        compensationFundExpensesTaxCategoryId:
          rawContext.compensation_fund_expenses_tax_category_id,
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
        incomeInAdvanceTaxCategoryId:
          rawContext.income_in_advance_tax_category_id ?? rawContext.default_tax_category_id,
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
          salaryExcessExpensesTaxCategoryId: rawContext.salary_excess_expenses_tax_category_id,
        },
      },
    };
  }

  public async getAdminContext(): Promise<AdminContext | null> {
    if (this.cachedContext) {
      return this.cachedContext;
    }

    const ownerId = await this.resolveOwnerIdForRequest();

    const contexts = await getAdminContexts.run({ ownerIds: [ownerId] }, this.db);
    const context = contexts[0] ? this.normalizeContext(contexts[0]) : null;
    this.cachedContext = context;
    return context;
  }

  public async getVerifiedAdminContext() {
    if (this.cachedContext) {
      return this.cachedContext;
    }

    this.cachedContextInitializing ??= this.getAdminContext();

    const context = await this.cachedContextInitializing;
    if (!context) {
      throw new GraphQLError('Admin context not found for the authenticated user.', {
        extensions: { code: 'FORBIDDEN' },
      });
    }
    return context;
  }

  public async updateAdminContext(params: IUpdateAdminContextParams): Promise<AdminContext | null> {
    const ownerId = await this.resolveOwnerIdForRequest();

    this.cachedContext = null;

    // Persist role rows for any legacy per-institution inputs BEFORE the update,
    // so the RETURNING aggregates below already include the change.
    await this.syncProviderBusinessRoles(ownerId, params);

    const updatedContexts = await updateAdminContext.run({ ...params, ownerId }, this.db);
    if (updatedContexts.length >= 1) {
      const normalizedContext = this.normalizeContext(updatedContexts[0]);
      this.cachedContext = normalizedContext;
      return normalizedContext;
    }
    return null;
  }

  /**
   * Write-through adapter for the legacy typed provider/authority business inputs:
   * upsert the matching admin_business_roles rows so the role-derived arrays stay
   * consistent when those inputs are used. Additive only (ON CONFLICT DO NOTHING) —
   * removals are owned by the Phase 2 data-source API. No-op (and no query) when
   * the update carries none of these inputs.
   */
  private async syncProviderBusinessRoles(
    ownerId: string,
    params: IUpdateAdminContextParams,
  ): Promise<void> {
    const values: unknown[] = [ownerId];
    const rows: string[] = [];
    for (const [key, role] of PROVIDER_INPUT_ROLES) {
      const businessId = params[key];
      if (typeof businessId === 'string' && businessId.length > 0) {
        rows.push(
          `($1, $${values.length + 1}, $${values.length + 2}::accounter_schema.admin_business_role)`,
        );
        values.push(businessId, role);
      }
    }
    if (rows.length === 0) {
      return;
    }
    await this.db.query(
      `INSERT INTO accounter_schema.admin_business_roles (owner_id, business_id, role)
       VALUES ${rows.join(', ')}
       ON CONFLICT DO NOTHING`,
      values,
    );
  }

  private async batchAdminContextsByOwnerIds(ownerIds: readonly string[]) {
    const uniqueOwnerIds = Array.from(new Set(ownerIds));
    const contexts = await getAdminContexts.run({ ownerIds: uniqueOwnerIds }, this.db);
    const contextsByOwnerId = new Map(contexts.map(c => [c.owner_id, c]));
    return ownerIds.map(id => {
      const context = contextsByOwnerId.get(id);
      return context ? this.normalizeContext(context) : null;
    });
  }

  public adminContextByOwnerIdLoader = new DataLoader((ownerIds: readonly string[]) =>
    this.batchAdminContextsByOwnerIds(ownerIds),
  );

  public clearCache() {
    this.cachedContext = null;
  }

  /**
   * Resolve the owner business for this request.
   * - Single-business read scope selects that business.
   * - Multi-business scope prefers the primary tenant business only when it is
   *   part of the scope; otherwise the first scoped business is used.
   * - No scope falls back to the primary tenant business.
   */
  private async resolveOwnerIdForRequest(): Promise<string> {
    await this.ensureAuthContext();

    if (!this.authContext) {
      throw new GraphQLError(
        'Auth context not available. AdminContextProvider requires active authentication.',
        { extensions: { code: 'UNAUTHENTICATED' } },
      );
    }

    const ownerId = resolveWriteTargetBusinessId(
      this.authContext.tenant.businessId,
      this.authContext.activeReadScope,
    );

    if (!ownerId) {
      throw new Error('AdminContextProvider: ownerId not found in context (currentUser)');
    }

    return ownerId;
  }

  /**
   * Lazy initialization of auth context on first use.
   * This ensures the async provider is called only when needed.
   */
  private async ensureAuthContext(): Promise<void> {
    if (this.authContextInitialized) {
      return;
    }

    this.authContext = await this.authContextProvider.getAuthContext();
    this.authContextInitialized = true;
  }
}
