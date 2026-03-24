/**
 * Imports Priority supplier invoices (חשבוניות ספק) from a CSV export into
 * accounter_schema.charges + accounter_schema.documents.
 *
 * Usage:
 *   node .yarn/releases/yarn-4.13.0.cjs tsx scripts/import-priority-csv.ts <path-to-csv>
 *
 * Example:
 *   node .yarn/releases/yarn-4.13.0.cjs tsx scripts/import-priority-csv.ts \
 *     ~/Downloads/2026/export_2026-03-24T08_28_21.909782.csv
 *
 * Idempotent: re-running skips already-imported invoices (keyed by serial_number).
 */
import * as fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { config } from 'dotenv';
import pg from 'pg';

config();

const CSV_PATH = process.argv[2];
if (!CSV_PATH) {
  console.error('Usage: tsx scripts/import-priority-csv.ts <path-to-csv>');
  process.exit(1);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parseDate(raw: string): string | null {
  // DD/MM/YYYY → YYYY-MM-DD
  if (!raw?.trim()) return null;
  const [d, m, y] = raw.trim().split('/');
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseCurrency(raw: string): string | null {
  const c = raw?.trim().toUpperCase();
  if (!c) return 'ILS';
  return ['ILS', 'USD', 'EUR', 'GBP'].includes(c) ? c : 'ILS';
}

function parseAmount(raw: string): number | null {
  const n = parseFloat(raw?.trim().replace(/,/g, '') || '');
  return isNaN(n) ? null : n;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function run() {
  const client = new pg.Client({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL === '1',
  });
  await client.connect();

  // Resolve owner from user_context (single source of truth for RLS)
  const ownerRes = await client.query<{ owner_id: string; name: string }>(
    `SELECT uc.owner_id, fe.name
     FROM accounter_schema.user_context uc
     JOIN accounter_schema.financial_entities fe ON fe.id = uc.owner_id
     LIMIT 1`,
  );
  if (ownerRes.rows.length === 0) {
    console.error('No user_context found. Run yarn seed:production first.');
    process.exit(1);
  }
  const ownerId = ownerRes.rows[0].owner_id;
  console.log(`Importing for owner: ${ownerRes.rows[0].name} (${ownerId})`);

  // Parse CSV
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true }) as Record<
    string,
    string
  >[];
  console.log(`Parsed ${rows.length} rows from CSV`);

  // Cache: priority_code → { id } for businesses and tax_categories
  const supplierCache = new Map<string, string>(); // priorityCode → business id
  const taxCategoryCache = new Map<string, string>(); // debitCode → tax_category id

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const serialNumber = row['מספר פנימי']?.trim();
    if (!serialNumber) { skipped++; continue; }

    // Skip if already imported
    const exists = await client.query(
      `SELECT 1 FROM accounter_schema.documents WHERE serial_number = $1 AND owner_id = $2`,
      [serialNumber, ownerId],
    );
    if (exists.rows.length > 0) { skipped++; continue; }

    try {
      // ── Supplier (creditor) ─────────────────────────────────────────────
      const supplierCode = row['חשבון זכות']?.trim();
      const supplierName = row['שם חשבון זכות']?.trim().replace(/\s*\(\d+\)\s*$/, '').trim();
      const vatNumber = row['תיק מע"מ']?.trim() || row['תיק מע""מ']?.trim() || null;

      let creditorId: string | null = null;
      if (supplierCode) {
        if (supplierCache.has(supplierCode)) {
          creditorId = supplierCache.get(supplierCode)!;
        } else {
          // Try find by name first
          const found = await client.query<{ id: string }>(
            `SELECT fe.id FROM accounter_schema.financial_entities fe
             WHERE fe.name = $1 AND fe.owner_id = $2 AND fe.type = 'business'`,
            [supplierName, ownerId],
          );
          if (found.rows.length > 0) {
            creditorId = found.rows[0].id;
          } else {
            // Create supplier
            const feRes = await client.query<{ id: string }>(
              `INSERT INTO accounter_schema.financial_entities (type, name, owner_id)
               VALUES ('business', $1, $2) RETURNING id`,
              [supplierName || supplierCode, ownerId],
            );
            creditorId = feRes.rows[0].id;
            await client.query(
              `INSERT INTO accounter_schema.businesses (id, owner_id, vat_number, no_invoices_required)
               VALUES ($1, $2, $3, TRUE) ON CONFLICT DO NOTHING`,
              [creditorId, ownerId, vatNumber],
            );
          }
          supplierCache.set(supplierCode, creditorId);
        }
      }

      // ── Tax category (expense category) ────────────────────────────────
      const debitCode = row['חשבון חובה']?.trim();
      const debitName = row['שם חשבון חובה']?.trim().replace(/\s*\([^)]+\)\s*$/, '').trim();

      let taxCategoryId: string | null = null;
      if (debitCode) {
        if (taxCategoryCache.has(debitCode)) {
          taxCategoryId = taxCategoryCache.get(debitCode)!;
        } else {
          const label = debitName || debitCode;
          const found = await client.query<{ id: string }>(
            `SELECT tc.id FROM accounter_schema.tax_categories tc
             JOIN accounter_schema.financial_entities fe ON fe.id = tc.id
             WHERE fe.name = $1 AND tc.owner_id = $2`,
            [label, ownerId],
          );
          if (found.rows.length > 0) {
            taxCategoryId = found.rows[0].id;
          } else {
            const feRes = await client.query<{ id: string }>(
              `INSERT INTO accounter_schema.financial_entities (type, name, owner_id)
               VALUES ('tax_category', $1, $2) RETURNING id`,
              [label, ownerId],
            );
            taxCategoryId = feRes.rows[0].id;
            await client.query(
              `INSERT INTO accounter_schema.tax_categories (id, owner_id)
               VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [taxCategoryId, ownerId],
            );
          }
          taxCategoryCache.set(debitCode, taxCategoryId);
        }
      }

      // ── Charge ──────────────────────────────────────────────────────────
      const chargeRes = await client.query<{ id: string }>(
        `INSERT INTO accounter_schema.charges
           (owner_id, type, tax_category_id, user_description, accountant_status)
         VALUES ($1, 'COMMON', $2, $3, 'APPROVED')
         RETURNING id`,
        [
          ownerId,
          taxCategoryId,
          [row['פרטים']?.trim(), row['פרטי חשבונית']?.trim()].filter(Boolean).join(' | ') || null,
        ],
      );
      const chargeId = chargeRes.rows[0].id;

      // ── Document ────────────────────────────────────────────────────────
      const invoiceDate = parseDate(row['תאריך חשבונית']);
      const valueDate = parseDate(row['תאריך ערך']);
      const currency = parseCurrency(row['מטבע']);
      const total = parseAmount(row['סה"כ חשבונית'] || row['סה""כ חשבונית']);
      const vat = parseAmount(row['חישוב מע"מ'] || row['חישוב מע""מ']);
      const noVat = total != null && vat != null ? total - vat : parseAmount(row['סכום במטבע מקור']);
      const externalNum = row['מספר חיצוני']?.trim() || null;

      await client.query(
        `INSERT INTO accounter_schema.documents
           (charge_id, owner_id, type, serial_number, date,
            total_amount, currency_code, vat_amount, no_vat_amount,
            creditor_id, is_reviewed,
            vat_report_date_override, description)
         VALUES ($1, $2, 'INVOICE', $3, $4,
                 $5, $6, $7, $8,
                 $9, TRUE,
                 $10, $11)`,
        [
          chargeId,
          ownerId,
          serialNumber,
          invoiceDate,
          total,
          currency,
          vat || 0,
          noVat,
          creditorId,
          valueDate,
          externalNum ? `External: ${externalNum}` : null,
        ],
      );

      inserted++;
      if (inserted % 50 === 0) console.log(`  ${inserted} imported...`);
    } catch (err) {
      console.error(`Error on ${serialNumber}:`, err);
      errors++;
    }
  }

  await client.end();
  console.log(`\nDone. Imported: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
  console.log(`Tax categories created: ${taxCategoryCache.size}`);
  console.log(`Suppliers created: ${supplierCache.size}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
