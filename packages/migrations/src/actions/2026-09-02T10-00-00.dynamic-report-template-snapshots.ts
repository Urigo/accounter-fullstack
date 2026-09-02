import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Change tracking for the dynamic report.
 *
 * `dynamic_report_templates` is overwritten on every save and keeps no history, and the client
 * strips computed values before persisting — so there is nothing to compare a reopened draft
 * against. These two additions give it a baseline:
 *
 * - `from_date` / `to_date` on the template, so a draft owns the period it was built for and a
 *   later diff is apples-to-apples. Nullable: templates predating this feature have no period
 *   until their next save, and the client falls back to its own defaults.
 * - a snapshot row per save, holding the tree and the figures exactly as they stood at that moment.
 *
 * Only leaf values are stored — branch sums are a pure function of the leaves and are recomputed
 * client-side, so persisting them would just be a second source of truth to keep consistent.
 *
 * The foreign key is composite because template identity is `(owner_id, name)`, and `ON UPDATE
 * CASCADE` is what makes rename safe: `updateTemplateName` rewrites the primary key, which would
 * otherwise orphan every snapshot the template has.
 */
export default {
  name: '2026-09-02T10-00-00.dynamic-report-template-snapshots.sql',
  run: ({ sql }) => sql`
ALTER TABLE accounter_schema.dynamic_report_templates
  ADD COLUMN IF NOT EXISTS from_date date,
  ADD COLUMN IF NOT EXISTS to_date   date;

CREATE TABLE IF NOT EXISTS accounter_schema.dynamic_report_template_snapshots
(
    id             uuid                     DEFAULT gen_random_uuid() NOT NULL
        CONSTRAINT dynamic_report_template_snapshots_pk PRIMARY KEY,
    owner_id       uuid                                               NOT NULL,
    template_name  text                                               NOT NULL,
    from_date      date                                               NOT NULL,
    to_date        date                                               NOT NULL,
    scope_owner_id uuid                                               NOT NULL,
    tree           jsonb                                              NOT NULL,
    leaf_values    jsonb                                              NOT NULL,
    created_by     uuid,
    created_at     timestamptz              DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT dynamic_report_template_snapshots_template_fk
        FOREIGN KEY (owner_id, template_name)
            REFERENCES accounter_schema.dynamic_report_templates (owner_id, name)
            ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS dynamic_report_template_snapshots_lookup_index
    ON accounter_schema.dynamic_report_template_snapshots (owner_id, template_name, created_at DESC);
`,
} satisfies MigrationExecutor;
