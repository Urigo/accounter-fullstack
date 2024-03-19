import { GraphQLError } from 'graphql';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { ENVIRONMENT } from '@shared/tokens';
import type { Environment } from '@shared/types';
import { fetch } from '@whatwg-node/fetch';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class CoinMarketCapProvider {
  constructor(@Inject(ENVIRONMENT) private env: Environment) {}

  public async getExchangeRates(
    coinmarketcapId: number,
    range?: { fromTimeStamp?: number; toTimeStamp?: number },
  ) {
    const rangeFilterQuery = range ? `&range=${range.fromTimeStamp}~${range.toTimeStamp}` : '';
    const url = new URL(
      `https://api.coinmarketcap.com/data-api/v3/cryptocurrency/detail/chart?id=${coinmarketcapId}${rangeFilterQuery}`,
    );

    try {
      const res = await fetch(url).catch(err => {
        console.error(err);
        throw new Error(`failed fetching data for ID="${coinmarketcapId}"`);
      });

      const rateData = await res.json();
      const ratesObject: Record<string, { c?: Array<number> } | undefined> = rateData?.data?.points;
      if (!ratesObject || Object.keys(ratesObject).length === 0) {
        console.error(
          `Unexpected data received from URL: ${url.toString()}\nData: ${JSON.stringify(rateData)}`,
        );
        throw new GraphQLError(`Unexpected response`);
      }
      return ratesObject;
    } catch (e) {
      throw new Error(`CoinMarketCap Error: ${(e as Error).message}`);
    }
  }
}
