import { parse } from 'csv-parse/sync';
import { Injectable, Scope } from 'graphql-modules';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';

function parseDate(raw: string): string | null {
  if (!raw?.trim()) return null;
  const [d, m, y] = raw.trim().split('/');
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseCurrency(raw: string): string {
  const c = raw?.trim().toUpperCase();
  return ['ILS', 'USD', 'EUR', 'GBP'].includes(c) ? c : 'ILS';
}

function parseAmount(raw: string): number | null {
  const n = parseFloat((raw ?? '').replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

export interface ImportCSVResult {
  imported: number;
  skipped: number;
  errors: number;
  suppliersCreated: number;
  taxCategoriesCreated: number;
}

@Injectable({ scope: Scope.Operation, global: true })
export class PriorityCSVImportProvider {
  constructor(private db: TenantAwareDBClient) {}

  async importCSV(csvContent: string): Promise<ImportCSVResult> {
    // Resolve owner from user_context (respects RLS — same owner the user operates under)
    const ownerRes = await this.db.query<{ owner_id: string }>(
      `SELECT uc.owner_id
       FROM accounter_schema.user_context uc
       LIMIT 1`,
    );
    if (ownerRes.rowCount === 0) throw new Error('No user context found');
    const ownerId = ownerRes.rows[0].owner_id;

    const rows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
    }) as Record<string, string>[];

    const supplierCache = new Map<string, string>();
    const taxCategoryCache = new Map<string, string>();
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
      const serialNumber = row['מספר פנימי']?.trim();
      if (!serialNumber) { skipped++; continue; }

      // Skip already-imported invoices
      const exists = await this.db.query(
        `SELECT 1 FROM accounter_schema.documents WHERE serial_number = $1 AND owner_id = $2`,
        [serialNumber, ownerId],
      );
      if ((exists.rowCount ?? 0) > 0) { skipped++; continue; }

      try {
        // ── Supplier ────────────────────────────────────────────────────
        const supplierCode = row['חשבון זכות']?.trim();
        const supplierName = row['שם חשבון זכות']?.trim().replace(/\s*\(\d+\)\s*$/, '').trim();
        const vatNumber = row['תיק מע"מ']?.trim() || row['תיק מע""מ']?.trim() || null;

        let creditorId: string | null = null;
        if (supplierCode) {
          if (supplierCache.has(supplierCode)) {
            creditorId = supplierCache.get(supplierCode)!;
          } else {
            const found = await this.db.query<{ id: string }>(
              `SELECT fe.id FROM accounter_schema.financial_entities fe
               WHERE fe.name = $1 AND fe.owner_id = $2 AND fe.type = 'business'`,
              [supplierName, ownerId],
            );
            if ((found.rowCount ?? 0) > 0) {
              creditorId = found.rows[0].id;
            } else {
              const feRes = await this.db.query<{ id: string }>(
                `INSERT INTO accounter_schema.financial_entities (type, name, owner_id)
                 VALUES ('business', $1, $2) RETURNING id`,
                [supplierName || supplierCode, ownerId],
              );
              creditorId = feRes.rows[0].id;
              await this.db.query(
                `INSERT INTO accounter_schema.businesses (id, owner_id, vat_number, no_invoices_required)
                 VALUES ($1, $2, $3, TRUE) ON CONFLICT DO NOTHING`,
                [creditorId, ownerId, vatNumber],
              );
              supplierCache.set(supplierCode, creditorId);
            }
            supplierCache.set(supplierCode, creditorId);
          }
        }

        // ── Tax category ────────────────────────────────────────────────
        const debitCode = row['חשבון חובה']?.trim();
        const debitName = row['שם חשבון חובה']?.trim().replace(/\s*\([^)]+\)\s*$/, '').trim();

        let taxCategoryId: string | null = null;
        if (debitCode) {
          if (taxCategoryCache.has(debitCode)) {
            taxCategoryId = taxCategoryCache.get(debitCode)!;
          } else {
            const label = debitName || debitCode;
            const found = await this.db.query<{ id: string }>(
              `SELECT tc.id FROM accounter_schema.tax_categories tc
               JOIN accounter_schema.financial_entities fe ON fe.id = tc.id
               WHERE fe.name = $1 AND tc.owner_id = $2`,
              [label, ownerId],
            );
            if ((found.rowCount ?? 0) > 0) {
              taxCategoryId = found.rows[0].id;
            } else {
              const feRes = await this.db.query<{ id: string }>(
                `INSERT INTO accounter_schema.financial_entities (type, name, owner_id)
                 VALUES ('tax_category', $1, $2) RETURNING id`,
                [label, ownerId],
              );
              taxCategoryId = feRes.rows[0].id;
              await this.db.query(
                `INSERT INTO accounter_schema.tax_categories (id, owner_id)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [taxCategoryId, ownerId],
              );
              taxCategoryCache.set(debitCode, taxCategoryId);
            }
            taxCategoryCache.set(debitCode, taxCategoryId);
          }
        }

        // ── Charge ──────────────────────────────────────────────────────
        const description = [row['פרטים']?.trim(), row['פרטי חשבונית']?.trim()]
          .filter(Boolean)
          .join(' | ') || null;

        const chargeRes = await this.db.query<{ id: string }>(
          `INSERT INTO accounter_schema.charges
             (owner_id, type, tax_category_id, user_description, accountant_status)
           VALUES ($1, 'COMMON', $2, $3, 'APPROVED')
           RETURNING id`,
          [ownerId, taxCategoryId, description],
        );
        const chargeId = chargeRes.rows[0].id;

        // ── Document ────────────────────────────────────────────────────
        const total = parseAmount(row['סה"כ חשבונית'] || row['סה""כ חשבונית']);
        const vat = parseAmount(row['חישוב מע"מ'] || row['חישוב מע""מ']);
        const noVat =
          total != null && vat != null ? total - vat : parseAmount(row['סכום במטבע מקור']);
        const externalNum = row['מספר חיצוני']?.trim() || null;

        await this.db.query(
          `INSERT INTO accounter_schema.documents
             (charge_id, owner_id, type, serial_number, date,
              total_amount, currency_code, vat_amount, no_vat_amount,
              creditor_id, is_reviewed, vat_report_date_override, description)
           VALUES ($1, $2, 'INVOICE', $3, $4,
                   $5, $6, $7, $8,
                   $9, TRUE, $10, $11)`,
          [
            chargeId,
            ownerId,
            serialNumber,
            parseDate(row['תאריך חשבונית']),
            total,
            parseCurrency(row['מטבע']),
            vat ?? 0,
            noVat,
            creditorId,
            parseDate(row['תאריך ערך']),
            externalNum ? `External: ${externalNum}` : null,
          ],
        );

        imported++;
      } catch (err) {
        console.error(`[PriorityCSVImport] Error on ${serialNumber}:`, err);
        errors++;
      }
    }

    return {
      imported,
      skipped,
      errors,
      suppliersCreated: supplierCache.size,
      taxCategoriesCreated: taxCategoryCache.size,
    };
  }
}
