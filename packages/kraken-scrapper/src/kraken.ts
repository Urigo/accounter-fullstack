import { Kraken as KrakenApi } from 'node-kraken-api';

const KRAKEN_PAGE_LIMIT = 50;

export function createKraken(options: { apiKey: string; apiSecret: string }) {
  const krakenInstance = new KrakenApi({
    key: options.apiKey,
    secret: options.apiSecret,
  });

  return {
    ledgers: async () => {
      let hasNextPage = false;
      let offset = 0;
      let results: Record<string, KrakenLedgerRecord> = {};

      do {
        const response = await krakenInstance.ledgers({ ofs: offset });
        const { ledger } = response;

        results = {
          ...results,
          ...ledger,
        };

        const count = Object.keys(ledger || {}).length;
        hasNextPage = count === KRAKEN_PAGE_LIMIT;
        offset += KRAKEN_PAGE_LIMIT;
      } while (hasNextPage);

      return results;
    },
    trades: async () => {
      let hasNextPage = false;
      let offset = 0;
      let results: Record<string, KrakenLedgerRecord> = {};

      do {
        const response = await krakenInstance.tradesHistory({ ofs: offset });
        const { trades } = response;

        results = {
          ...results,
          ...trades,
        };

        const count = Object.keys(trades || {}).length;
        hasNextPage = count === KRAKEN_PAGE_LIMIT;
        offset += KRAKEN_PAGE_LIMIT;
      } while (hasNextPage);

      return results;
    },
  };
}

export type Kraken = ReturnType<typeof createKraken>;
export type KrakenLedgerRecord = NonNullable<
  Awaited<ReturnType<KrakenApi['ledgers']>>['ledger']
>[string];

export type KrakenTradeRecord = NonNullable<
  Awaited<ReturnType<KrakenApi['tradesHistory']>>['trades']
>[string];
