import type { Client } from 'pg';

/**
 * Seed FIAT exchange rates for demo data.
 *
 * Inserts or updates exchange rates for common currencies to ILS.
 * Uses ON CONFLICT to ensure idempotent seeding.
 *
 * **Schema Note**: The exchange_rates table stores rates as individual columns
 * (usd, eur, gbp, etc.) for a given exchange_date, NOT as normalized rows.
 * This denormalized structure optimizes read performance for multi-currency queries.
 *
 * Example row:
 * | exchange_date | usd | eur | gbp |
 * | 2024-11-26    | 3.5 | 4.0 | 4.5 |
 *
 * Rates seeded:
 * - USD: 3.5 ILS
 * - EUR: 4.0 ILS
 * - GBP: 4.5 ILS
 */
export async function seedExchangeRates(client: Client): Promise<void> {
  await client.query(
    `INSERT INTO accounter_schema.exchange_rates (exchange_date, usd, eur, gbp)
     VALUES (CURRENT_DATE, 3.5, 4.0, 4.5)
     ON CONFLICT (exchange_date)
     DO UPDATE SET usd = EXCLUDED.usd, eur = EXCLUDED.eur, gbp = EXCLUDED.gbp`,
  );
}
