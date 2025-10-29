import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import { adminBusinessUpdateSchema } from '../helpers/admin-businesses.helper.js';
import type {
  IGetAdminBusinessesByIdsQuery,
  IGetAllAdminBusinessesQuery,
  IGetAllAdminBusinessesResult,
  IUpdateAdminBusinessesParams,
  IUpdateAdminBusinessesQuery,
  IUpdateAdminBusinessesResult,
} from '../types.js';

const getAdminBusinessesByIds = sql<IGetAdminBusinessesByIdsQuery>`
    SELECT ab.*, f.name, b.vat_number
    FROM accounter_schema.businesses_admin ab
    INNER JOIN accounter_schema.businesses b
      USING (id)
    INNER JOIN accounter_schema.financial_entities f
      USING (id)
    WHERE ab.id IN $$ids;`;

const getAllAdminBusinesses = sql<IGetAllAdminBusinessesQuery>`
    SELECT ab.*, f.name, b.vat_number
    FROM accounter_schema.businesses_admin ab
    INNER JOIN accounter_schema.businesses b
      USING (id)
    INNER JOIN accounter_schema.financial_entities f
      USING (id)
    INNER JOIN accounter_schema.financial_entities fe
      USING (id);`;

const updateAdminBusinesses = sql<IUpdateAdminBusinessesQuery>`
    UPDATE accounter_schema.businesses_admin
    SET
    business_registration_start_date = COALESCE(
      $businessRegistrationStartDate,
      business_registration_start_date
    ),
    company_tax_id = COALESCE(
      $companyTaxId,
      company_tax_id
    ),
    advance_tax_rates = COALESCE(
      $advanceTaxRates,
      advance_tax_rates
    ),
    tax_advances_ids = COALESCE(
      $taxAdvancesIds,
      tax_advances_ids
    ),
    social_security_employer_ids = COALESCE(
      $socialSecurityEmployerIds,
      social_security_employer_ids
    ),
    withholding_tax_annual_ids = COALESCE(
      $withholdingTaxAnnualIds,
      withholding_tax_annual_ids
    )
    WHERE
      id = $id
    RETURNING *;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AdminBusinessesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchAdminBusinessesByIds(ids: readonly string[]) {
    const uniqueIds = [...new Set(ids)];
    const adminBusinesses = await getAdminBusinessesByIds.run(
      {
        ids: uniqueIds,
      },
      this.dbProvider,
    );
    return ids.map(id => adminBusinesses.find(admin => admin.id === id));
  }

  public getAdminBusinessByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchAdminBusinessesByIds(ids),
    {
      cacheKeyFn: id => `admin-business-${id}`,
      cacheMap: this.cache,
    },
  );

  public getAllAdminBusinesses() {
    const data = this.cache.get<IGetAllAdminBusinessesResult[]>('all-admin-businesses');
    if (data) {
      return Promise.resolve(data);
    }
    return getAllAdminBusinesses.run(undefined, this.dbProvider).then(result => {
      this.cache.set('all-admin-businesses', result);
      return result;
    });
  }

  public async updateAdminBusiness(
    params: IUpdateAdminBusinessesParams,
  ): Promise<IUpdateAdminBusinessesResult> {
    const inputParams = adminBusinessUpdateSchema.parse(params);
    const [result] = await updateAdminBusinesses.run(inputParams, this.dbProvider);
    this.clearCache();
    return result;
  }

  public clearCache() {
    this.cache.clear();
  }
}
