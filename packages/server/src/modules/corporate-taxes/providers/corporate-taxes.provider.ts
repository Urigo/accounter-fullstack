import DataLoader from 'dataloader';
import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import type {
  IDeleteCorporateTaxParams,
  IDeleteCorporateTaxQuery,
  IGetCorporateTaxesByCorporateIdsQuery,
  IGetCorporateTaxesByCorporateIdsResult,
  IInsertCorporateTaxParams,
  IInsertCorporateTaxQuery,
  IUpdateCorporateTaxParams,
  IUpdateCorporateTaxQuery,
} from '../types.js';

const getCorporateTaxesByCorporateIds = sql<IGetCorporateTaxesByCorporateIdsQuery>`
  SELECT *
  FROM accounter_schema.corporate_tax_variables
  WHERE corporate_id IN $$corporateIds
  ORDER BY date DESC;`;

const updateCorporateTax = sql<IUpdateCorporateTaxQuery>`
  UPDATE accounter_schema.corporate_tax_variables
  SET
  date = COALESCE(
    $date,
    date
  ),
  tax_rate = COALESCE(
    $taxRate,
    tax_rate
  )
  WHERE
    corporate_id = $corporateId
    AND date = $originalDate
  RETURNING *;`;

const insertCorporateTax = sql<IInsertCorporateTaxQuery>`
  INSERT INTO accounter_schema.corporate_tax_variables (corporate_id, date, tax_rate)
  VALUES ($corporateId, $date, $taxRate)
  RETURNING *`;

const deleteCorporateTax = sql<IDeleteCorporateTaxQuery>`
  DELETE FROM accounter_schema.corporate_tax_variables
  WHERE corporate_id = $corporateId
  AND date = $date
  RETURNING *`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class CorporateTaxesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });
  adminBusinessId: string;

  constructor(
    @Inject(CONTEXT) private context: GraphQLModules.Context,
    private dbProvider: DBProvider,
  ) {
    this.adminBusinessId = this.context.currentUser.userId;
  }

  public getAllCorporateTaxes() {
    const cached = this.cache.get<IGetCorporateTaxesByCorporateIdsResult[]>(
      `corporate-taxes-${this.adminBusinessId}`,
    );
    if (cached) {
      return Promise.resolve(cached);
    }
    return getCorporateTaxesByCorporateIds
      .run({ corporateIds: [this.adminBusinessId] }, this.dbProvider)
      .then(res => {
        this.cache.set(`corporate-taxes-${this.adminBusinessId}`, res);
        return res;
      });
  }

  private async batchCorporateTaxesByDates(
    taxRates: readonly { date: TimelessDateString; corporateId: string }[],
  ) {
    const rates = await this.getAllCorporateTaxes();
    return taxRates.map(({ date, corporateId }) => {
      const time = new Date(date).getTime();
      return rates
        .filter(rate => rate.corporate_id === corporateId)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .find(rate => rate.date.getTime() <= time);
    });
  }

  public getCorporateTaxesByDateLoader = new DataLoader(
    (taxRates: readonly TimelessDateString[]) =>
      this.batchCorporateTaxesByDates(
        taxRates.map(date => ({ date, corporateId: this.adminBusinessId })),
      ),
    {
      cacheKeyFn: date => `corporate-tax-${this.adminBusinessId}-${date}`,
      cacheMap: this.cache,
    },
  );

  private async batchCorporateTaxesByCorporateIds(corporateIds: readonly string[]) {
    const taxes = await getCorporateTaxesByCorporateIds.run({ corporateIds }, this.dbProvider);
    return corporateIds.map(id => taxes.filter(expense => expense.corporate_id === id));
  }

  public getCorporateTaxesByCorporateIdLoader = new DataLoader(
    (corporateIds: readonly string[]) => this.batchCorporateTaxesByCorporateIds(corporateIds),
    {
      cacheKeyFn: corporateId => `corporate-taxes-${corporateId}`,
      cacheMap: this.cache,
    },
  );

  public updateCorporateTax(params: IUpdateCorporateTaxParams) {
    this.clearCache();
    return updateCorporateTax.run(params, this.dbProvider);
  }

  public insertCorporateTax(params: IInsertCorporateTaxParams) {
    this.clearCache();
    return insertCorporateTax.run(params, this.dbProvider);
  }

  public deleteCorporateTax(params: IDeleteCorporateTaxParams) {
    this.clearCache();
    return deleteCorporateTax.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
