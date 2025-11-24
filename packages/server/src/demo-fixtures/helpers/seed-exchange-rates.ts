import type { Client } from 'pg';

/**
 * Seed FIAT exchange rates for demo data.
 *
 * Inserts or updates exchange rates for common currencies to ILS.
 * Uses ON CONFLICT to ensure idempotent seeding.
 *
 * Rates seeded:
 * - USD → ILS: 3.5
 * - EUR → ILS: 4.0
 * - GBP → ILS: 4.5
 */
export async function seedExchangeRates(client: Client): Promise<void> {
  const rates = [
    { from: 'USD', to: 'ILS', rate: 3.5 },
    { from: 'EUR', to: 'ILS', rate: 4.0 },
    { from: 'GBP', to: 'ILS', rate: 4.5 },
  ];

  for (const { from, to, rate } of rates) {
    await client.query(
      `INSERT INTO accounter_schema.exchange_rates (from_currency, to_currency, rate, date)
       VALUES ($1, $2, $3, CURRENT_DATE)
       ON CONFLICT (from_currency, to_currency, date)
       DO UPDATE SET rate = EXCLUDED.rate`,
      [from, to, rate],
    );
  }
}
