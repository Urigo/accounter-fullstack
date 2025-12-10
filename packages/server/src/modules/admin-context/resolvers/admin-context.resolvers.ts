import { GraphQLError } from 'graphql';
import { TagsProvider } from '../../../modules/tags/providers/tags.provider.js';
import { Currency } from '../../../shared/enums.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { fetchBusiness, fetchTaxCategory } from '../helpers/admin-context.helper.js';
import { AdminContextProvider } from '../providers/admin-context.provider.js';
import type { AdminContextModule } from '../types.js';

export const adminContextResolvers: AdminContextModule.Resolvers = {
  Query: {
    adminContext: (_, { ownerId }, { injector, adminContext: { defaultAdminBusinessId } }) =>
      injector
        .get(AdminContextProvider)
        .getAdminContextLoader.load(ownerId ?? defaultAdminBusinessId)
        .then(res => {
          if (!res) {
            const message = 'Admin context not found';
            console.error(`${message} for owner id "${ownerId}"`);
            throw new GraphQLError(message);
          }
          return res;
        })
        .catch(e => {
          if (e instanceof GraphQLError) {
            throw e;
          }
          console.error(JSON.stringify(e, null, 2));
          throw new GraphQLError(`Error fetching admin context`);
        }),
  },
  Mutation: {
    updateAdminContext: (_, { context }, { injector }) =>
      injector
        .get(AdminContextProvider)
        .updateAdminContext({
          ...context,
        })
        .then(res => {
          if (!res[0]) {
            throw new GraphQLError(`Error updating admin context`);
          }
          return res[0];
        })
        .catch(e => {
          if (e instanceof GraphQLError) {
            throw e;
          }
          console.error(JSON.stringify(e, null, 2));
          throw new GraphQLError(`Error updating admin context`);
        }),
  },
  AdminContext: {
    id: dbAdminContext => dbAdminContext.owner_id,
    ownerId: dbAdminContext => dbAdminContext.owner_id,
    defaultLocalCurrency: dbAdminContext => dbAdminContext.default_local_currency as Currency,
    defaultForeignCurrency: dbAdminContext =>
      dbAdminContext.default_fiat_currency_for_crypto_conversions as Currency,
    defaultTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(injector, 'defaultTaxCategory', dbAdminContext.default_tax_category_id),
    locality: dbAdminContext => dbAdminContext.locality,
    vatBusiness: async (dbAdminContext, _, { injector }) =>
      fetchBusiness(injector, 'vatBusiness', dbAdminContext.vat_business_id),
    inputVatTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(injector, 'inputVatTaxCategory', dbAdminContext.input_vat_tax_category_id),
    outputVatTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(injector, 'outputVatTaxCategory', dbAdminContext.output_vat_tax_category_id),
    taxBusiness: async (dbAdminContext, _, { injector }) =>
      fetchBusiness(injector, 'taxBusiness', dbAdminContext.tax_business_id),
    taxExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'taxExpensesTaxCategory',
        dbAdminContext.tax_expenses_tax_category_id,
      ),
    socialSecurityBusiness: async (dbAdminContext, _, { injector }) =>
      fetchBusiness(injector, 'socialSecurityBusiness', dbAdminContext.social_security_business_id),
    exchangeRateTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'exchangeRateTaxCategory',
        dbAdminContext.exchange_rate_tax_category_id,
      ),
    incomeExchangeRateTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'incomeExchangeRateTaxCategory',
        dbAdminContext.income_exchange_rate_tax_category_id,
      ),
    exchangeRateRevaluationTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'exchangeRateRevaluationTaxCategory',
        dbAdminContext.exchange_rate_revaluation_tax_category_id,
      ),
    feeTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(injector, 'feeTaxCategory', dbAdminContext.fee_tax_category_id),
    generalFeeTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'generalFeeTaxCategory',
        dbAdminContext.general_fee_tax_category_id,
      ),
    fineTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(injector, 'fineTaxCategory', dbAdminContext.fine_tax_category_id),
    untaxableGiftsTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'untaxableGiftsTaxCategory',
        dbAdminContext.untaxable_gifts_tax_category_id,
      ),
    balanceCancellationTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'balanceCancellationTaxCategory',
        dbAdminContext.balance_cancellation_tax_category_id,
      ),
    developmentForeignTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'developmentForeignTaxCategory',
        dbAdminContext.development_foreign_tax_category_id,
      ),
    developmentLocalTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'developmentLocalTaxCategory',
        dbAdminContext.development_local_tax_category_id,
      ),
    accumulatedDepreciationTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.accumulated_depreciation_tax_category_id
        ? fetchTaxCategory(
            injector,
            'accumulatedDepreciationTaxCategory',
            dbAdminContext.accumulated_depreciation_tax_category_id,
          )
        : null,
    rndDepreciationExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.rnd_depreciation_expenses_tax_category_id
        ? fetchTaxCategory(
            injector,
            'rndDepreciationExpensesTaxCategory',
            dbAdminContext.rnd_depreciation_expenses_tax_category_id,
          )
        : null,
    gnmDepreciationExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.gnm_depreciation_expenses_tax_category_id
        ? fetchTaxCategory(
            injector,
            'gnmDepreciationExpensesTaxCategory',
            dbAdminContext.gnm_depreciation_expenses_tax_category_id,
          )
        : null,
    marketingDepreciationExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.marketing_depreciation_expenses_tax_category_id
        ? fetchTaxCategory(
            injector,
            'marketingDepreciationExpensesTaxCategory',
            dbAdminContext.marketing_depreciation_expenses_tax_category_id,
          )
        : null,
    bankDepositInterestIncomeTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.bank_deposit_interest_income_tax_category_id
        ? fetchTaxCategory(
            injector,
            'bankDepositInterestIncomeTaxCategory',
            dbAdminContext.bank_deposit_interest_income_tax_category_id,
          )
        : null,
    businessTripTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.business_trip_tax_category_id
        ? fetchTaxCategory(
            injector,
            'businessTripTaxCategory',
            dbAdminContext.business_trip_tax_category_id,
          )
        : null,
    businessTripTag: async (dbAdminContext, _, { injector }) => {
      if (!dbAdminContext.business_trip_tag_id) {
        return null;
      }
      return injector
        .get(TagsProvider)
        .getTagByIDLoader.load(dbAdminContext.business_trip_tag_id)
        .then(res => {
          if (!res) {
            throw new GraphQLError(
              `Business trip tag (with ID="${dbAdminContext.business_trip_tag_id}") not found`,
            );
          }
          return res;
        })
        .catch(e => {
          if (e instanceof GraphQLError) {
            throw e;
          }
          console.error(JSON.stringify(e, null, 2));
          throw new GraphQLError(`Error fetching business trip tag`);
        });
    },
    expensesToPayTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'expensesToPayTaxCategory',
        dbAdminContext.expenses_to_pay_tax_category_id,
      ),
    expensesInAdvanceTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'expensesInAdvanceTaxCategory',
        dbAdminContext.expenses_in_advance_tax_category_id,
      ),
    incomeToCollectTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'incomeToCollectTaxCategory',
        dbAdminContext.income_to_collect_tax_category_id,
      ),
    incomeInAdvanceTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.income_in_advance_tax_category_id
        ? fetchTaxCategory(
            injector,
            'incomeInAdvanceTaxCategory',
            dbAdminContext.income_in_advance_tax_category_id,
          )
        : null,
    zkufotExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.zkufot_expenses_tax_category_id
        ? fetchTaxCategory(
            injector,
            'zkufotExpensesTaxCategory',
            dbAdminContext.zkufot_expenses_tax_category_id,
          )
        : null,
    zkufotIncomeTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.zkufot_income_tax_category_id
        ? fetchTaxCategory(
            injector,
            'zkufotIncomeTaxCategory',
            dbAdminContext.zkufot_income_tax_category_id,
          )
        : null,
    socialSecurityExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.social_security_expenses_tax_category_id
        ? fetchTaxCategory(
            injector,
            'socialSecurityExpensesTaxCategory',
            dbAdminContext.social_security_expenses_tax_category_id,
          )
        : null,
    salaryExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salary_expenses_tax_category_id
        ? fetchTaxCategory(
            injector,
            'salaryExpensesTaxCategory',
            dbAdminContext.salary_expenses_tax_category_id,
          )
        : null,
    trainingFundExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.training_fund_expenses_tax_category_id
        ? fetchTaxCategory(
            injector,
            'trainingFundExpensesTaxCategory',
            dbAdminContext.training_fund_expenses_tax_category_id,
          )
        : null,
    pensionFundExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.pension_fund_expenses_tax_category_id
        ? fetchTaxCategory(
            injector,
            'pensionFundExpensesTaxCategory',
            dbAdminContext.pension_fund_expenses_tax_category_id,
          )
        : null,
    compensationFundExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.compensation_fund_expenses_tax_category_id
        ? fetchTaxCategory(
            injector,
            'compensationFundExpensesTaxCategory',
            dbAdminContext.compensation_fund_expenses_tax_category_id,
          )
        : null,
    batchedEmployeesBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.batched_employees_business_id
        ? fetchBusiness(
            injector,
            'batchedEmployeesBusiness',
            dbAdminContext.batched_employees_business_id,
          )
        : null,
    batchedFundsBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.batched_funds_business_id
        ? fetchBusiness(injector, 'batchedFundsBusiness', dbAdminContext.batched_funds_business_id)
        : null,
    taxDeductionsBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.tax_deductions_business_id
        ? fetchBusiness(
            injector,
            'taxDeductionsBusiness',
            dbAdminContext.tax_deductions_business_id,
          )
        : null,
    recoveryReserveExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.recovery_reserve_expenses_tax_category_id
        ? fetchTaxCategory(
            injector,
            'recoveryReserveExpensesTaxCategory',
            dbAdminContext.recovery_reserve_expenses_tax_category_id,
          )
        : null,
    recoveryReserveTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.recovery_reserve_tax_category_id
        ? fetchTaxCategory(
            injector,
            'recoveryReserveTaxCategory',
            dbAdminContext.recovery_reserve_tax_category_id,
          )
        : null,
    vacationReserveExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.vacation_reserve_expenses_tax_category_id
        ? fetchTaxCategory(
            injector,
            'vacationReserveExpensesTaxCategory',
            dbAdminContext.vacation_reserve_expenses_tax_category_id,
          )
        : null,
    vacationReserveTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.vacation_reserve_tax_category_id
        ? fetchTaxCategory(
            injector,
            'vacationReserveTaxCategory',
            dbAdminContext.vacation_reserve_tax_category_id,
          )
        : null,
    poalimBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.poalim_business_id
        ? fetchBusiness(injector, 'poalimBusiness', dbAdminContext.poalim_business_id)
        : null,
    discountBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.discount_business_id
        ? fetchBusiness(injector, 'discountBusiness', dbAdminContext.discount_business_id)
        : null,
    isracardBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.isracard_business_id
        ? fetchBusiness(injector, 'isracardBusiness', dbAdminContext.isracard_business_id)
        : null,
    amexBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.amex_business_id
        ? fetchBusiness(injector, 'amexBusiness', dbAdminContext.amex_business_id)
        : null,
    calBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.cal_business_id
        ? fetchBusiness(injector, 'calBusiness', dbAdminContext.cal_business_id)
        : null,
    etanaBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.etana_business_id
        ? fetchBusiness(injector, 'etanaBusiness', dbAdminContext.etana_business_id)
        : null,
    krakenBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.kraken_business_id
        ? fetchBusiness(injector, 'krakenBusiness', dbAdminContext.kraken_business_id)
        : null,
    etherscanBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.etherscan_business_id
        ? fetchBusiness(injector, 'etherscanBusiness', dbAdminContext.etherscan_business_id)
        : null,
    swiftBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.swift_business_id
        ? fetchBusiness(injector, 'swiftBusiness', dbAdminContext.swift_business_id)
        : null,
    bankDepositBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.bank_deposit_business_id
        ? fetchBusiness(injector, 'bankDepositBusiness', dbAdminContext.bank_deposit_business_id)
        : null,
    dividendWithholdingTaxBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.dividend_withholding_tax_business_id
        ? fetchBusiness(
            injector,
            'dividendWithholdingTaxBusiness',
            dbAdminContext.dividend_withholding_tax_business_id,
          )
        : null,
    dividendTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.dividend_tax_category_id
        ? fetchTaxCategory(injector, 'dividendTaxCategory', dbAdminContext.dividend_tax_category_id)
        : null,
    salaryExcessExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'salaryExcessExpensesTaxCategory',
        dbAdminContext.salary_excess_expenses_tax_category_id,
      ),
    ledgerLock: dbAdminContext =>
      dbAdminContext.ledger_lock ? dateToTimelessDateString(dbAdminContext.ledger_lock) : null,
    foreignSecuritiesBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.foreign_securities_business_id
        ? fetchBusiness(
            injector,
            'foreignSecuritiesBusiness',
            dbAdminContext.foreign_securities_business_id,
          )
        : null,
    foreignSecuritiesFeesCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.foreign_securities_fees_category_id
        ? fetchTaxCategory(
            injector,
            'foreignSecuritiesFeesCategory',
            dbAdminContext.foreign_securities_fees_category_id,
          )
        : null,
  },
};
