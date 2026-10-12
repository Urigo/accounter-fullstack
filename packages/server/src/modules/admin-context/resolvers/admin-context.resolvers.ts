import { GraphQLError } from 'graphql';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { TaxCategoriesProvider } from '../../financial-entities/providers/tax-categories.provider.js';
import { SortCodesProvider } from '../../sort-codes/providers/sort-codes.provider.js';
import { TagsProvider } from '../../tags/providers/tags.provider.js';
import { fetchBusiness, fetchTaxCategory } from '../helpers/admin-context.helper.js';
import {
  parseSecuritiesContextPatch,
  SECURITIES_TAX_CATEGORY_KEYS,
  securitiesTaxCategoryLabel,
  type SecuritiesContextPatch,
} from '../helpers/securities-context.helper.js';
import { AdminContextProvider } from '../providers/admin-context.provider.js';
import type { AdminContext, AdminContextModule, SecuritiesContextProto } from '../types.js';

function toSecuritiesContextProto(context: AdminContext): SecuritiesContextProto {
  return {
    ownerId: context.ownerId,
    foreignSecuritiesBusinessId: context.foreignSecurities.foreignSecuritiesBusinessId,
    sortCode: context.foreignSecurities.sortCode,
    taxCategories: context.foreignSecurities.taxCategories,
  };
}

export const adminContextResolvers: AdminContextModule.Resolvers = {
  Query: {
    adminContext: (_, __, { injector }) =>
      injector
        .get(AdminContextProvider)
        .getVerifiedAdminContext()
        .then(res => {
          if (!res) {
            const message = 'Admin context not found';
            console.error(message);
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
          if (!res) {
            throw new GraphQLError(`Error updating admin context`);
          }
          return res;
        })
        .catch(e => {
          if (e instanceof GraphQLError) {
            throw e;
          }
          console.error(JSON.stringify(e, null, 2));
          throw new GraphQLError(`Error updating admin context`);
        }),
    updateSecuritiesContext: async (_, { input }, { injector }) => {
      let patch: SecuritiesContextPatch;
      try {
        patch = parseSecuritiesContextPatch(input);
      } catch (e) {
        throw new GraphQLError(`Invalid securities context: ${(e as Error).message}`);
      }

      // jsonb has no foreign keys: make sure every id is a tax category of the business being
      // configured — not merely one the request can read, which in a multi-business scope spans
      // other businesses too — and the sort code one of its sort codes, before storing them.
      const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      const assignments = (patch.taxCategories ?? []).filter(
        (assignment): assignment is { key: typeof assignment.key; taxCategoryId: string } =>
          !!assignment.taxCategoryId,
      );
      const taxCategories = await Promise.all(
        assignments.map(({ taxCategoryId }) =>
          injector.get(TaxCategoriesProvider).taxCategoryByIdLoader.load(taxCategoryId),
        ),
      );
      const unknown = assignments.filter((_, index) => taxCategories[index]?.owner_id !== ownerId);
      if (unknown.length) {
        throw new GraphQLError(
          `Tax category not found in this business: ${unknown
            .map(
              ({ key, taxCategoryId }) =>
                `${securitiesTaxCategoryLabel(key)} (ID="${taxCategoryId}")`,
            )
            .join(', ')}`,
        );
      }

      if (patch.foreignSecuritiesBusinessId) {
        const business = await injector
          .get(BusinessesProvider)
          .getBusinessByIdLoader.load(patch.foreignSecuritiesBusinessId);
        if (business?.owner_id !== ownerId) {
          throw new GraphQLError(
            `Foreign securities business not found in this business: ID="${patch.foreignSecuritiesBusinessId}"`,
          );
        }
      }

      if (patch.sortCode != null) {
        const sortCode = await injector
          .get(SortCodesProvider)
          .getSortCodesByIdLoader.load({ key: patch.sortCode, ownerId });
        if (!sortCode) {
          throw new GraphQLError(`Sort code ${patch.sortCode} not found`);
        }
      }

      try {
        const context = await injector.get(AdminContextProvider).updateSecuritiesContext(patch);
        return toSecuritiesContextProto(context);
      } catch (e) {
        if (e instanceof GraphQLError) {
          throw e;
        }
        console.error('Error updating securities context', e);
        throw new GraphQLError('Error updating securities context');
      }
    },
  },
  SecuritiesContext: {
    id: parent => `${parent.ownerId}-securities-context`,
    foreignSecuritiesBusiness: async (parent, _, { injector }) =>
      parent.foreignSecuritiesBusinessId
        ? fetchBusiness(injector, 'foreignSecuritiesBusiness', parent.foreignSecuritiesBusinessId)
        : null,
    sortCode: async (parent, _, { injector }) =>
      parent.sortCode == null
        ? null
        : injector
            .get(SortCodesProvider)
            .getSortCodesByIdLoader.load({ key: parent.sortCode, ownerId: parent.ownerId })
            .then(sortCode => sortCode ?? null),
    taxCategories: parent =>
      SECURITIES_TAX_CATEGORY_KEYS.map(key => ({
        ownerId: parent.ownerId,
        key,
        taxCategoryId: parent.taxCategories[key] ?? null,
      })),
  },
  SecuritiesTaxCategoryAssignment: {
    id: parent => `${parent.ownerId}-securities-${parent.key}`,
    key: parent => parent.key,
    taxCategory: async (parent, _, { injector }) =>
      parent.taxCategoryId
        ? injector
            .get(TaxCategoriesProvider)
            .taxCategoryByIdLoader.load(parent.taxCategoryId)
            .then(taxCategory => taxCategory ?? null)
        : null,
  },
  AdminContextInfo: {
    id: dbAdminContext => dbAdminContext.ownerId,
    ownerId: dbAdminContext => dbAdminContext.ownerId,
    defaultLocalCurrency: dbAdminContext => dbAdminContext.defaultLocalCurrency,
    defaultForeignCurrency: dbAdminContext => dbAdminContext.defaultCryptoConversionFiatCurrency,
    defaultTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(injector, 'defaultTaxCategory', dbAdminContext.defaultTaxCategoryId),
    locality: dbAdminContext => dbAdminContext.locality,
    vatBusiness: async (dbAdminContext, _, { injector }) =>
      fetchBusiness(injector, 'vatBusiness', dbAdminContext.authorities.vatBusinessId),
    inputVatTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'inputVatTaxCategory',
        dbAdminContext.authorities.inputVatTaxCategoryId,
      ),
    outputVatTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'outputVatTaxCategory',
        dbAdminContext.authorities.outputVatTaxCategoryId,
      ),
    propertyOutputVatTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'propertyOutputVatTaxCategory',
        dbAdminContext.authorities.propertyOutputVatTaxCategoryId,
      ),
    taxBusiness: async (dbAdminContext, _, { injector }) =>
      fetchBusiness(injector, 'taxBusiness', dbAdminContext.authorities.taxBusinessId),
    taxExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'taxExpensesTaxCategory',
        dbAdminContext.authorities.taxExpensesTaxCategoryId,
      ),
    socialSecurityBusiness: async (dbAdminContext, _, { injector }) =>
      fetchBusiness(
        injector,
        'socialSecurityBusiness',
        dbAdminContext.authorities.socialSecurityBusinessId,
      ),
    exchangeRateTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'exchangeRateTaxCategory',
        dbAdminContext.general.taxCategories.exchangeRateTaxCategoryId,
      ),
    incomeExchangeRateTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'incomeExchangeRateTaxCategory',
        dbAdminContext.general.taxCategories.incomeExchangeRateTaxCategoryId,
      ),
    exchangeRateRevaluationTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'exchangeRateRevaluationTaxCategory',
        dbAdminContext.general.taxCategories.exchangeRevaluationTaxCategoryId,
      ),
    feeTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'feeTaxCategory',
        dbAdminContext.general.taxCategories.feeTaxCategoryId,
      ),
    generalFeeTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'generalFeeTaxCategory',
        dbAdminContext.general.taxCategories.generalFeeTaxCategoryId,
      ),
    fineTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'fineTaxCategory',
        dbAdminContext.general.taxCategories.fineTaxCategoryId,
      ),
    untaxableGiftsTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'untaxableGiftsTaxCategory',
        dbAdminContext.general.taxCategories.untaxableGiftsTaxCategoryId,
      ),
    balanceCancellationTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'balanceCancellationTaxCategory',
        dbAdminContext.general.taxCategories.balanceCancellationTaxCategoryId,
      ),
    developmentForeignTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'developmentForeignTaxCategory',
        dbAdminContext.general.taxCategories.developmentForeignTaxCategoryId,
      ),
    developmentLocalTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'developmentLocalTaxCategory',
        dbAdminContext.general.taxCategories.developmentLocalTaxCategoryId,
      ),
    accumulatedDepreciationTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.depreciation.accumulatedDepreciationTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'accumulatedDepreciationTaxCategory',
            dbAdminContext.depreciation.accumulatedDepreciationTaxCategoryId,
          )
        : null,
    rndDepreciationExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.depreciation.rndDepreciationExpensesTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'rndDepreciationExpensesTaxCategory',
            dbAdminContext.depreciation.rndDepreciationExpensesTaxCategoryId,
          )
        : null,
    gnmDepreciationExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.depreciation.gnmDepreciationExpensesTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'gnmDepreciationExpensesTaxCategory',
            dbAdminContext.depreciation.gnmDepreciationExpensesTaxCategoryId,
          )
        : null,
    marketingDepreciationExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.depreciation.marketingDepreciationExpensesTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'marketingDepreciationExpensesTaxCategory',
            dbAdminContext.depreciation.marketingDepreciationExpensesTaxCategoryId,
          )
        : null,
    bankDepositInterestIncomeTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.bankDeposits.bankDepositInterestIncomeTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'bankDepositInterestIncomeTaxCategory',
            dbAdminContext.bankDeposits.bankDepositInterestIncomeTaxCategoryId,
          )
        : null,
    businessTripTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.businessTrips.businessTripTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'businessTripTaxCategory',
            dbAdminContext.businessTrips.businessTripTaxCategoryId,
          )
        : null,
    businessTripTag: async (dbAdminContext, _, { injector }) => {
      if (!dbAdminContext.businessTrips.businessTripTagId) {
        return null;
      }
      return injector
        .get(TagsProvider)
        .getTagByIDLoader.load(dbAdminContext.businessTrips.businessTripTagId)
        .then(res => {
          if (!res) {
            throw new GraphQLError(
              `Business trip tag (with ID="${dbAdminContext.businessTrips.businessTripTagId}") not found`,
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
        dbAdminContext.crossYear.expensesToPayTaxCategoryId,
      ),
    expensesInAdvanceTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'expensesInAdvanceTaxCategory',
        dbAdminContext.crossYear.expensesInAdvanceTaxCategoryId,
      ),
    incomeToCollectTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'incomeToCollectTaxCategory',
        dbAdminContext.crossYear.incomeToCollectTaxCategoryId,
      ),
    incomeInAdvanceTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.crossYear.incomeInAdvanceTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'incomeInAdvanceTaxCategory',
            dbAdminContext.crossYear.incomeInAdvanceTaxCategoryId,
          )
        : null,
    zkufotExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.zkufotExpensesTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'zkufotExpensesTaxCategory',
            dbAdminContext.salaries.zkufotExpensesTaxCategoryId,
          )
        : null,
    zkufotIncomeTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.zkufotIncomeTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'zkufotIncomeTaxCategory',
            dbAdminContext.salaries.zkufotIncomeTaxCategoryId,
          )
        : null,
    socialSecurityExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.socialSecurityExpensesTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'socialSecurityExpensesTaxCategory',
            dbAdminContext.salaries.socialSecurityExpensesTaxCategoryId,
          )
        : null,
    salaryExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.salaryExpensesTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'salaryExpensesTaxCategory',
            dbAdminContext.salaries.salaryExpensesTaxCategoryId,
          )
        : null,
    trainingFundExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.trainingFundExpensesTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'trainingFundExpensesTaxCategory',
            dbAdminContext.salaries.trainingFundExpensesTaxCategoryId,
          )
        : null,
    pensionFundExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.pensionExpensesTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'pensionFundExpensesTaxCategory',
            dbAdminContext.salaries.pensionExpensesTaxCategoryId,
          )
        : null,
    compensationFundExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.compensationFundExpensesTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'compensationFundExpensesTaxCategory',
            dbAdminContext.salaries.compensationFundExpensesTaxCategoryId,
          )
        : null,
    batchedEmployeesBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.batchedEmployeesBusinessId
        ? fetchBusiness(
            injector,
            'batchedEmployeesBusiness',
            dbAdminContext.salaries.batchedEmployeesBusinessId,
          )
        : null,
    batchedFundsBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.batchedFundsBusinessId
        ? fetchBusiness(
            injector,
            'batchedFundsBusiness',
            dbAdminContext.salaries.batchedFundsBusinessId,
          )
        : null,
    taxDeductionsBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.taxDeductionsBusinessId
        ? fetchBusiness(
            injector,
            'taxDeductionsBusiness',
            dbAdminContext.salaries.taxDeductionsBusinessId,
          )
        : null,
    recoveryReserveExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.recoveryReserveExpensesTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'recoveryReserveExpensesTaxCategory',
            dbAdminContext.salaries.recoveryReserveExpensesTaxCategoryId,
          )
        : null,
    recoveryReserveTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.recoveryReserveTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'recoveryReserveTaxCategory',
            dbAdminContext.salaries.recoveryReserveTaxCategoryId,
          )
        : null,
    vacationReserveExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.vacationReserveExpensesTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'vacationReserveExpensesTaxCategory',
            dbAdminContext.salaries.vacationReserveExpensesTaxCategoryId,
          )
        : null,
    vacationReserveTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.salaries.vacationReserveTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'vacationReserveTaxCategory',
            dbAdminContext.salaries.vacationReserveTaxCategoryId,
          )
        : null,
    poalimBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.financialAccounts.poalimBusinessId
        ? fetchBusiness(
            injector,
            'poalimBusiness',
            dbAdminContext.financialAccounts.poalimBusinessId,
          )
        : null,
    discountBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.financialAccounts.discountBusinessId
        ? fetchBusiness(
            injector,
            'discountBusiness',
            dbAdminContext.financialAccounts.discountBusinessId,
          )
        : null,
    otsarHahayalBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.financialAccounts.otsarHahayalBusinessId
        ? fetchBusiness(
            injector,
            'otsarHahayalBusiness',
            dbAdminContext.financialAccounts.otsarHahayalBusinessId,
          )
        : null,
    isracardBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.financialAccounts.isracardBusinessId
        ? fetchBusiness(
            injector,
            'isracardBusiness',
            dbAdminContext.financialAccounts.isracardBusinessId,
          )
        : null,
    amexBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.financialAccounts.amexBusinessId
        ? fetchBusiness(injector, 'amexBusiness', dbAdminContext.financialAccounts.amexBusinessId)
        : null,
    calBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.financialAccounts.calBusinessId
        ? fetchBusiness(injector, 'calBusiness', dbAdminContext.financialAccounts.calBusinessId)
        : null,
    otsarHahayalCreditCardBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.financialAccounts.otsarHahayalCreditCardBusinessId
        ? fetchBusiness(
            injector,
            'otsarHahayalCreditCardBusiness',
            dbAdminContext.financialAccounts.otsarHahayalCreditCardBusinessId,
          )
        : null,
    etanaBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.financialAccounts.etanaBusinessId
        ? fetchBusiness(injector, 'etanaBusiness', dbAdminContext.financialAccounts.etanaBusinessId)
        : null,
    krakenBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.financialAccounts.krakenBusinessId
        ? fetchBusiness(
            injector,
            'krakenBusiness',
            dbAdminContext.financialAccounts.krakenBusinessId,
          )
        : null,
    etherscanBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.financialAccounts.etherScanBusinessId
        ? fetchBusiness(
            injector,
            'etherscanBusiness',
            dbAdminContext.financialAccounts.etherScanBusinessId,
          )
        : null,
    swiftBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.financialAccounts.swiftBusinessId
        ? fetchBusiness(injector, 'swiftBusiness', dbAdminContext.financialAccounts.swiftBusinessId)
        : null,
    bankDepositBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.bankDeposits.bankDepositBusinessId
        ? fetchBusiness(
            injector,
            'bankDepositBusiness',
            dbAdminContext.bankDeposits.bankDepositBusinessId,
          )
        : null,
    dividendWithholdingTaxBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.dividends.dividendWithholdingTaxBusinessId
        ? fetchBusiness(
            injector,
            'dividendWithholdingTaxBusiness',
            dbAdminContext.dividends.dividendWithholdingTaxBusinessId,
          )
        : null,
    dividendTaxCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.dividends.dividendTaxCategoryId
        ? fetchTaxCategory(
            injector,
            'dividendTaxCategory',
            dbAdminContext.dividends.dividendTaxCategoryId,
          )
        : null,
    salaryExcessExpensesTaxCategory: async (dbAdminContext, _, { injector }) =>
      fetchTaxCategory(
        injector,
        'salaryExcessExpensesTaxCategory',
        dbAdminContext.general.taxCategories.salaryExcessExpensesTaxCategoryId,
      ),
    ledgerLock: dbAdminContext => dbAdminContext.ledgerLock ?? null,
    dateEstablished: dbAdminContext => dbAdminContext.dateEstablished ?? null,
    initialAccounterYear: dbAdminContext => dbAdminContext.initialAccounterYear ?? null,
    // populated from securities_context (see `normalizeContext`), not the legacy columns
    foreignSecuritiesBusiness: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.foreignSecurities.foreignSecuritiesBusinessId
        ? fetchBusiness(
            injector,
            'foreignSecuritiesBusiness',
            dbAdminContext.foreignSecurities.foreignSecuritiesBusinessId,
          )
        : null,
    foreignSecuritiesFeesCategory: async (dbAdminContext, _, { injector }) =>
      dbAdminContext.foreignSecurities.foreignSecuritiesFeesCategoryId
        ? fetchTaxCategory(
            injector,
            'foreignSecuritiesFeesCategory',
            dbAdminContext.foreignSecurities.foreignSecuritiesFeesCategoryId,
          )
        : null,
    securitiesContext: dbAdminContext => toSecuritiesContextProto(dbAdminContext),
  },
};
