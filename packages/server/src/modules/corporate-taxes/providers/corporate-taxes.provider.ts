import DataLoader from 'dataloader';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { AUTH_CONTEXT } from '../../../shared/tokens.js';
import type { AuthContext } from '../../../shared/types/auth.js';
import { TimelessDateString } from '../../../shared/types/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
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
  ),
  original_tax_rate = COALESCE(
    $originalTaxRate,
    original_tax_rate
  )
  WHERE
    corporate_id = $corporateId
    AND date = $originalDate
  RETURNING *;`;

const insertCorporateTax = sql<IInsertCorporateTaxQuery>`
  INSERT INTO accounter_schema.corporate_tax_variables (corporate_id, date, tax_rate, original_tax_rate)
  VALUES ($corporateId, $date, $taxRate, $originalTaxRate)
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
  constructor(
    private dbProvider: DBProvider,
    @Inject(AUTH_CONTEXT) private authContext: AuthContext,
  ) {}

  private get businessId() {
    return this.authContext.tenant?.businessId;
  }

  private allCorporateTaxesCache = new Map<
    string,
    Promise<IGetCorporateTaxesByCorporateIdsResult[]>
  >();
  public getAllCorporateTaxes(corporateId: string) {
    if (this.allCorporateTaxesCache.has(corporateId)) {
      return this.allCorporateTaxesCache.get(corporateId)!;
    }
    this.allCorporateTaxesCache.set(
      corporateId,
      getCorporateTaxesByCorporateIds.run({ corporateIds: [corporateId] }, this.dbProvider),
    );
    return this.allCorporateTaxesCache.get(corporateId)!;
  }

  private async batchCorporateTaxesByDates(
    taxRates: readonly { date: TimelessDateString; corporateId: string }[],
  ) {
    const corporateIds = [...new Set(taxRates.map(t => t.corporateId))];
    const rates = (await Promise.all(corporateIds.map(id => this.getAllCorporateTaxes(id)))).flat();

    return taxRates.map(({ date, corporateId }) => {
      const time = new Date(date).getTime();
      return rates
        .filter(rate => rate.corporate_id === corporateId)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .find(rate => rate.date.getTime() <= time);
    });
  }

  public getCorporateTaxesByDateLoader = new DataLoader((dates: readonly TimelessDateString[]) => {
    if (!this.businessId) {
      throw new Error('Business ID is required for getCorporateTaxesByDateLoader');
    }
    return this.batchCorporateTaxesByDates(
      dates.map(date => ({ date, corporateId: this.businessId! })),
    );
  });

  private async batchCorporateTaxesByCorporateIds(corporateIds: readonly string[]) {
    const taxes = await getCorporateTaxesByCorporateIds.run({ corporateIds }, this.dbProvider);
    return corporateIds.map(id => taxes.filter(expense => expense.corporate_id === id));
  }

  public getCorporateTaxesByCorporateIdLoader = new DataLoader((corporateIds: readonly string[]) =>
    this.batchCorporateTaxesByCorporateIds(corporateIds),
  );

  public updateCorporateTax(params: IUpdateCorporateTaxParams) {
    return updateCorporateTax.run(params, this.dbProvider);
  }

  public insertCorporateTax(params: IInsertCorporateTaxParams) {
    return insertCorporateTax.run(params, this.dbProvider);
  }

  public deleteCorporateTax(params: IDeleteCorporateTaxParams) {
    return deleteCorporateTax.run(params, this.dbProvider);
  }
}
