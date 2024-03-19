import { GraphQLError } from 'graphql';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { ENVIRONMENT } from '@shared/tokens';
import type { Environment } from '@shared/types';

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
      console.debug(`TEMP Fetching data from CoinMarketCap for ID="${coinmarketcapId}"`);
      const res = await fetch(url).catch(err => {
        console.error(err);
        throw new Error(`failed fetching data for ID="${coinmarketcapId}"`);
      });

      console.debug(`TEMP Got res: ${res}`);

      const rateData = await res.json();
      const ratesObject: Record<string, { c?: Array<number> } | undefined> = rateData?.data?.points;

      console.debug(`TEMP Got JSON: ${rateData}`);

      if (!ratesObject || Object.keys(ratesObject).length === 0) {
        console.error(
          `Unexpected data received from URL: ${url.toString()}\nData: ${JSON.stringify(rateData)}`,
        );
        throw new Error(`Unexpected response`);
      }

      console.debug(`TEMP completed successfully: ${ratesObject}`);
      return ratesObject;
    } catch (e) {
      throw new GraphQLError(`CoinMarketCap Error: ${(e as Error).message}`);
    }
  }
}
