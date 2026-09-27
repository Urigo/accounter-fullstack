import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Accountant approval for the dynamic report.
 *
 * Snapshots already hold the tree and the leaf values as they stood at each save. Approvals need
 * two more things per leaf, stored on the same row so a snapshot stays a self-contained record of
 * what was reviewed:
 *
 * - `leaf_fingerprints`: entity id -> hash of the ledger records behind that leaf, with the same
 *   coverage as `leaf_values`. It lets a later visit tell "the figure is the same" apart from "the
 *   figure is the same but the records under it changed".
 * - `leaf_approvals`: entity id -> the reviewer's status for that leaf (`APPROVED` / `PENDING` /
 *   `UNAPPROVED`), stamped with who set it and when. An absent entry means never reviewed.
 *
 * Both are nullable and legacy rows stay `NULL` (no backfill): snapshots predating this feature
 * simply have nothing recorded. RLS already covers the table, and the template FK's
 * `ON UPDATE CASCADE ON DELETE CASCADE` means a rename keeps the approvals and a delete drops them.
 *
 * The composite index backs picking the newest comparable snapshot (same template, period and
 * scope) as the default baseline, which otherwise scans every snapshot of the template.
 */
export default {
  name: '2026-09-23T10-00-00.dynamic-report-snapshot-approvals.sql',
  run: ({ sql }) => sql`
ALTER TABLE accounter_schema.dynamic_report_template_snapshots
  ADD COLUMN IF NOT EXISTS leaf_fingerprints jsonb,
  ADD COLUMN IF NOT EXISTS leaf_approvals    jsonb;

CREATE INDEX IF NOT EXISTS dynamic_report_template_snapshots_comparable_index
    ON accounter_schema.dynamic_report_template_snapshots
        (owner_id, template_name, from_date, to_date, scope_owner_id, created_at DESC);
`,
} satisfies MigrationExecutor;
