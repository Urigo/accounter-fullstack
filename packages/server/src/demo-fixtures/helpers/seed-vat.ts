import type { Client } from 'pg';

/**
 * Seed VAT percentage history for demo data.
 *
 * Inserts historical VAT rates with effective dates. Israel's VAT has changed
 * over time, so we maintain a history table to support accurate calculations
 * for documents from different time periods.
 *
 * **Schema Note**: Percentage stored as decimal (0.17 = 17%), not integer.
 * Column name is 'date', not 'effective_date' or 'effectiveDate'.
 *
 * Current rates:
 * - 17% effective from 2015-01-01
 * - 18% effective from 2025-01-01
 *
 * Uses ON CONFLICT to ensure idempotency across multiple seed runs.
 *
 * @param client - PostgreSQL client instance
 */
export async function seedVATDefault(client: Client): Promise<void> {
  const vatRates = [
    { percentage: 0.17, date: '2015-01-01' },
    { percentage: 0.18, date: '2025-01-01' },
  ];

  for (const { percentage, date } of vatRates) {
    await client.query(
      `INSERT INTO accounter_schema.vat_value (percentage, date)
       VALUES ($1, $2)
       ON CONFLICT (date) DO NOTHING`,
      [percentage, date],
    );
  }
}
