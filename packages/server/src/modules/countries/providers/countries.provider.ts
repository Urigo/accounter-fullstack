import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type { IGetAllCountriesQuery } from '../types.js';

const getAllCountries = sql<IGetAllCountriesQuery>`
    SELECT *
    FROM accounter_schema.countries;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class CountriesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 60, // 1 hours
  });

  constructor(private dbProvider: DBProvider) {}

  public getAllCountries() {
    return getAllCountries.run(undefined, this.dbProvider).then(countries => {
      if (countries) {
        this.cache.set('all-countries', countries);
        countries.map(country => {
          this.cache.set(`country-${country.code}`, country);
        });
      }
      return countries;
    });
  }

  private async batchCountryByCode(codes: readonly string[]) {
    const countries = await this.getAllCountries();
    return codes.map(code => countries.find(country => country.code === code));
  }

  public getCountryByCodeLoader = new DataLoader(
    (codes: readonly string[]) => this.batchCountryByCode(codes),
    {
      cacheKeyFn: code => `country-${code}`,
      cacheMap: this.cache,
    },
  );

  public clearCache() {
    this.cache.clear();
  }
}
