import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { dateToTimelessDateString, getCacheInstance } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import type { IGetAllVatValuesQuery, IGetAllVatValuesResult } from '../types.js';

const getAllVatValues = sql<IGetAllVatValuesQuery>`
  SELECT *
  FROM accounter_schema.vat_value
  ORDER BY date DESC;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class VatProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 60 * 24, // 24 hours
  });

  constructor(private dbProvider: DBProvider) {}

  public getAllVatValues() {
    const data = this.cache.get('all-vat-values');
    if (data) {
      return data as Array<IGetAllVatValuesResult>;
    }
    return getAllVatValues.run(undefined, this.dbProvider).then(data => {
      this.cache.set('all-vat-values', data);
      return data;
    });
  }

  private async batchVatValuesByDates(dates: readonly TimelessDateString[]) {
    const vatValues = await this.getAllVatValues();

    return dates.map(date => {
      const record = vatValues.find(value => dateToTimelessDateString(value.date) <= date);
      const value = record ? Number(record.percentage) : null;
      return value;
    });
  }

  public getVatValueByDateLoader = new DataLoader(
    (dates: readonly TimelessDateString[]) => this.batchVatValuesByDates(dates),
    {
      cacheKeyFn: key => `vat-value-date-${key}`,
      cacheMap: this.cache,
    },
  );

  public clearCache() {
    this.cache.clear();
  }
}
