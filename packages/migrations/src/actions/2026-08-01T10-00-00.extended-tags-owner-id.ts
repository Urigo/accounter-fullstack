import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-08-01T10-00-00.extended-tags-owner-id.sql',
  run: ({ sql }) => sql`
    -- Expose tags.owner_id through the extended_tags view so Tag.ownerId can be
    -- resolved (and rows can be attributed to a business).
    --
    -- CREATE OR REPLACE VIEW may append columns but never reorder or rename the
    -- existing ones, so owner_id goes LAST in both the CTE column list and the
    -- final SELECT.
    create or replace view accounter_schema.extended_tags
        (id, parent, name, names_path, ids_path, owner_id)
    as
    WITH RECURSIVE get_ancestor(id, parent, name, names_path, ids_path, owner_id
        ) AS (SELECT t.id
                , t.parent
                , t.name
                , NULL::TEXT[]
                , NULL::UUID[]
                , t.owner_id
            FROM accounter_schema.tags t
            WHERE parent IS NULL
            UNION
            SELECT t.id,
                    t.parent,
                    t.name,
                    CASE WHEN g.names_path IS NULL THEN ARRAY[g.name] ELSE array_append(g.names_path, g.name) END,
                    CASE WHEN g.ids_path IS NULL THEN ARRAY[g.id] ELSE array_append(g.ids_path, g.id) END,
                    t.owner_id
            FROM get_ancestor g
                    JOIN accounter_schema.tags t ON t.parent = g.id)
    SELECT *
    FROM get_ancestor;
  `,
} satisfies MigrationExecutor;
