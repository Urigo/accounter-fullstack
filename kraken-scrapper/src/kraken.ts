import { Kraken as KrakenApi } from 'node-kraken-api';

export function createKraken(options: { apiKey: string; apiSecret: string }) {
  const krakenInstance = new KrakenApi({
    key: options.apiKey,
    secret: options.apiSecret,
  });

  return {
    ledgers: () => krakenInstance.ledgers().then(r => r.ledger || {}),
    trades: () => krakenInstance.tradesHistory().then(r => r.trades || {}),
  };
}

export type Kraken = ReturnType<typeof createKraken>;
export type KrakenLedgerRecord = NonNullable<Awaited<ReturnType<Kraken['ledgers']>>>[string];
export type KrakenTradeRecord = NonNullable<Awaited<ReturnType<Kraken['trades']>>>[string];
