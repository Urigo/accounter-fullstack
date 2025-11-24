import type { Client } from 'pg';

/**
 * Seed VAT percentage history for demo data.
 *
 * Inserts historical VAT rates:
 * - 17% effective from 2015-01-01
 * - 18% effective from 2025-01-01
 *
 * Uses ON CONFLICT to ensure idempotency across multiple seed runs.
 *
 * @param client - PostgreSQL client instance
 */
export async function seedVATDefault(client: Client): Promise<void> {
  const vatRates = [
    { percentage: 17, effectiveDate: '2015-01-01' },
    { percentage: 18, effectiveDate: '2025-01-01' },
  ];

  for (const { percentage, effectiveDate } of vatRates) {
    await client.query(
      `INSERT INTO accounter_schema.vat_value (percentage, effective_date)
       VALUES ($1, $2)
       ON CONFLICT (effective_date) DO NOTHING`,
      [percentage, effectiveDate],
    );
  }
}
