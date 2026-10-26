import { GraphQLError } from 'graphql';
import type { Currency } from '../../../shared/enums.js';
import { formatFinancialAmount, formatFinancialIntAmount } from '../../../shared/helpers/amount.js';
import { currentTenantYear, todayTimelessDate } from '../../../shared/helpers/tenant-timezone.js';
import { compareTimelessDates } from '../../../shared/helpers/timeless-date.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ScopeProvider } from '../../auth/providers/scope.provider.js';
import { CorporateTaxesProvider } from '../../corporate-taxes/providers/corporate-taxes.provider.js';
import { AdminBusinessesProvider } from '../../financial-entities/providers/admin-businesses.provider.js';
import {
  collectHalfDisposals,
  collectHalfSecuritiesExpenses,
  collectHalfSecuritiesIncome,
  type SemiAnnualIssue,
} from '../helpers/securities-semi-annual-report-data.helper.js';
import {
  computeSemiAnnualDeclaration,
  getSemiAnnualPeriod,
} from '../helpers/securities-semi-annual-report.helper.js';
import type { ReportsModule } from '../types.js';

const MIN_YEAR = 2000;

export const securitiesSemiAnnualReportResolvers: ReportsModule.Resolvers = {
  Query: {
    securitiesSemiAnnualReport: async (
      _,
      { year, half, priorYearsLosses, businessId: requestedBusinessId },
      { injector },
    ) => {
      if (!Number.isInteger(year) || year < MIN_YEAR || year > currentTenantYear() + 1) {
        throw new GraphQLError(`Invalid year: ${year}`);
      }
      if (
        priorYearsLosses != null &&
        (!Number.isFinite(priorYearsLosses) || priorYearsLosses < 0)
      ) {
        throw new GraphQLError('Prior years losses must be a non-negative amount');
      }

      // A requested business must be within the read scope; default to the request's own
      let ownerId: string;
      if (requestedBusinessId) {
        await injector.get(ScopeProvider).getReadScope([requestedBusinessId]);
        ownerId = requestedBusinessId;
      } else {
        ({ ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext());
      }

      const period = getSemiAnnualPeriod(year, half);
      const [ownerAdminContext, owner, corporateTaxes] = await Promise.all([
        injector.get(AdminContextProvider).adminContextByOwnerIdLoader.load(ownerId),
        injector.get(AdminBusinessesProvider).getAdminBusinessByIdLoader.load(ownerId),
        injector.get(CorporateTaxesProvider).getCorporateTaxesByCorporateIdLoader.load(ownerId),
      ]);
      if (!ownerAdminContext) {
        throw new GraphQLError(`No admin context is set for business ${ownerId}`);
      }
      if (!owner) {
        throw new GraphQLError(`Business ${ownerId} is not an admin business`);
      }
      const localCurrency = ownerAdminContext.defaultLocalCurrency;

      const firstHalf = half === 'H2' ? getSemiAnnualPeriod(year, 'H1') : null;
      const adminContext = ownerAdminContext;
      const [disposals, securitiesIncome, securitiesExpenses, firstHalfDisposals, firstHalfIncome] =
        await Promise.all([
          collectHalfDisposals(injector, { ownerId, period, localCurrency }),
          collectHalfSecuritiesIncome(injector, { ownerId, period, adminContext }),
          collectHalfSecuritiesExpenses(injector, { ownerId, period, adminContext }),
          firstHalf
            ? collectHalfDisposals(injector, { ownerId, period: firstHalf, localCurrency })
            : null,
          firstHalf
            ? collectHalfSecuritiesIncome(injector, { ownerId, period: firstHalf, adminContext })
            : null,
        ]);
      // whole shekels per category, so the categories add up to the line
      const expenses = securitiesExpenses.expenses.map(expense => ({
        ...expense,
        amount: Math.round(expense.amount),
      }));

      // the regular rate, as on "special" income: a reduced preferred-enterprise rate does not
      // reach capital gains or passive income
      const corporateTax = [...corporateTaxes]
        .sort((a, b) => compareTimelessDates(b.date, a.date))
        .find(row => compareTimelessDates(row.date, period.fromDate) <= 0);
      const taxRate = corporateTax ? Number(corporateTax.original_tax_rate) / 100 : null;

      const declaration = computeSemiAnnualDeclaration({
        half,
        taxRate: taxRate != null && Number.isFinite(taxRate) ? taxRate : null,
        priorYearsLosses: priorYearsLosses ?? 0,
        sales: disposals.sales,
        income: securitiesIncome.income,
        expenses: expenses.reduce((total, expense) => total + expense.amount, 0),
        firstHalf:
          firstHalfDisposals && firstHalfIncome
            ? { sales: firstHalfDisposals.sales, income: firstHalfIncome.income }
            : undefined,
      });

      const issues: SemiAnnualIssue[] = [];
      if (compareTimelessDates(todayTimelessDate(), period.toDate) <= 0) {
        issues.push({ message: `The half has not ended yet: the figures cover it until today` });
      }
      if (declaration.capitalGainsTax == null) {
        issues.push({
          message: `No corporate tax rate is set for ${period.fromDate}, so no tax or advance is worked out`,
        });
      }
      issues.push(
        ...securitiesExpenses.issues,
        ...disposals.issues,
        ...securitiesIncome.issues,
        ...[...(firstHalfDisposals?.issues ?? []), ...(firstHalfIncome?.issues ?? [])].map(
          issue => ({
            ...issue,
            message: `First half (losses carried to this one): ${issue.message}`,
          }),
        ),
      );

      const id = `securities-semi-annual:${ownerId}:${year}:${half}:${priorYearsLosses ?? 0}`;
      const int = (amount: number) => formatFinancialIntAmount(amount, localCurrency);
      const intOrNull = (amount: number | null) => (amount == null ? null : int(amount));
      const amount = (value: number, currency: Currency = localCurrency) =>
        formatFinancialAmount(value, currency);

      return {
        id,
        owner,
        year,
        half,
        fromDate: period.fromDate,
        toDate: period.toDate,
        dueDate: period.dueDate,
        taxRate: declaration.capitalGainsTax == null ? null : taxRate,
        salesTurnover: int(declaration.salesTurnover),
        totalRealGains: int(declaration.totalRealGains),
        totalLosses: int(declaration.totalLosses),
        periodNetRealCapitalGain: int(declaration.netRealCapitalGain),
        inflationaryAmount: int(declaration.inflationaryAmount),
        priorYearsLosses: int(declaration.priorYearsLosses),
        firstHalfNetRealCapitalGain: intOrNull(declaration.firstHalfNetRealCapitalGain),
        lossesCarriedForward: int(declaration.lossesCarriedForward),
        netRealCapitalGain: int(declaration.netRealCapitalGainAfterLosses),
        dividendIncome: int(declaration.dividendIncome),
        interestIncome: int(declaration.interestIncome),
        incomeSummary: declaration.incomeSummary.map(bucket => ({
          id: `${id}:income:${bucket.kind}:${bucket.locality}`,
          kind: bucket.kind,
          locality: bucket.locality,
          gross: int(bucket.gross),
          foreignTaxWithheld: int(bucket.foreignTaxWithheld),
          israeliTaxWithheld: int(bucket.israeliTaxWithheld),
          taxable: bucket.taxable,
          capitalLossOffset: int(bucket.capitalLossOffset),
          expensesDeducted: int(bucket.expensesDeducted),
          tax: intOrNull(bucket.tax),
          foreignTaxCredit: intOrNull(bucket.foreignTaxCredit),
        })),
        capitalLossOffsetAgainstIncome: int(declaration.capitalLossOffsetAgainstIncome),
        securitiesExpenses: int(declaration.securitiesExpenses),
        expenseSummary: expenses.map(expense => ({
          id: `${id}:expense:${expense.key}`,
          key: expense.key,
          taxCategoryId: expense.taxCategoryId,
          name: expense.name,
          amount: int(expense.amount),
        })),
        expensesDeductedFromGains: int(declaration.expensesDeductedFromGains),
        expensesDeductedFromIncome: int(declaration.expensesDeductedFromIncome),
        unusedExpenses: int(declaration.unusedExpenses),
        taxableCapitalGain: int(declaration.taxableCapitalGain),
        capitalGainsTax: intOrNull(declaration.capitalGainsTax),
        dividendsTax: intOrNull(declaration.dividendsTax),
        interestTax: intOrNull(declaration.interestTax),
        grossTax: intOrNull(declaration.grossTax),
        foreignTaxCredit: intOrNull(declaration.foreignTaxCredit),
        taxLiability: intOrNull(declaration.taxLiability),
        israeliTaxWithheldOnSales: int(declaration.israeliTaxWithheld),
        israeliTaxWithheldOnIncome: int(declaration.israeliTaxWithheldOnIncome),
        israeliTaxWithheldOnExemptIncome: int(declaration.israeliTaxWithheldOnExemptIncome),
        taxAdvance: intOrNull(declaration.taxAdvance),
        excessCredits: intOrNull(declaration.excessCredits),
        advanceNotes: declaration.advanceNotes,
        sales: disposals.sales.map(sale => ({
          id: sale.id,
          securityBusinessId: sale.securityBusinessId,
          tradeDate: sale.tradeDate,
          tradeType: sale.tradeType,
          security: sale.security,
          quantity: sale.quantity,
          consideration: amount(sale.consideration),
          cost: sale.cost == null ? null : amount(sale.cost),
          nominalGain: sale.nominalGain == null ? null : amount(sale.nominalGain),
          inflationaryAmount: sale.realGain == null ? null : amount(sale.inflationaryAmount),
          realGain: sale.realGain == null ? null : amount(sale.realGain),
          israeliTaxWithheld: amount(sale.israeliTaxWithheld),
          error: sale.error,
        })),
        incomeItems: securitiesIncome.income.map(item => ({
          id: item.id,
          kind: item.kind,
          locality: item.locality,
          chargeId: item.chargeId,
          date: item.date,
          security: item.security,
          description: item.description,
          gross: amount(item.gross),
          foreignTaxWithheld: amount(item.foreignTaxWithheld),
          israeliTaxWithheld: amount(item.israeliTaxWithheld),
        })),
        issues: issues.map((issue, index) => ({
          id: `${id}:issue:${index}`,
          message: issue.message,
          executionId: issue.executionId ?? null,
          chargeId: issue.chargeId ?? null,
          missingTaxCategory: issue.missingTaxCategory ?? null,
        })),
      };
    },
  },
};
