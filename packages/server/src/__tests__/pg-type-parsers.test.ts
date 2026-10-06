import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgTypeParsers } from '../shared/helpers/pg-type-parsers.js';
import { assertTestDatabaseIsLocal, testDbConfig } from './helpers/test-db-config.js';
import { TEST_TIMEZONES, useTimezone } from './helpers/timezones.js';

describe('pgTypeParsers', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    assertTestDatabaseIsLocal();
    pool = new pg.Pool({ ...testDbConfig, max: 2, types: pgTypeParsers });
  });

  afterAll(async () => {
    await pool?.end();
  });

  describe.each(TEST_TIMEZONES)('with the server in TZ=%s', timeZone => {
    useTimezone(timeZone);

    it('reads `date` columns as the stored yyyy-mm-dd string', async () => {
      const { rows } = await pool.query(`
        SELECT
          '2026-05-01'::date AS first_of_month,
          '2025-12-31'::date AS end_of_year,
          '2024-02-29'::date AS leap_day,
          NULL::date AS missing
      `);
      expect(rows[0]).toEqual({
        first_of_month: '2026-05-01',
        end_of_year: '2025-12-31',
        leap_day: '2024-02-29',
        missing: null,
      });
    });

    it('reads `date[]` columns as arrays of yyyy-mm-dd strings', async () => {
      const { rows } = await pool.query(`
        SELECT
          ARRAY['2026-05-01', NULL, '2025-12-31']::date[] AS days,
          ARRAY[]::date[] AS no_days
      `);
      expect(rows[0]).toEqual({ days: ['2026-05-01', null, '2025-12-31'], no_days: [] });
    });

    it('writes yyyy-mm-dd parameters as the same calendar day', async () => {
      const { rows } = await pool.query(`SELECT $1::date AS day, $1::date::text AS as_text`, [
        '2026-05-01',
      ]);
      expect(rows[0]).toEqual({ day: '2026-05-01', as_text: '2026-05-01' });
    });

    it('keeps the default parsing for points in time and other types', async () => {
      const { rows } = await pool.query(`
        SELECT
          '2026-05-01T10:00:00Z'::timestamptz AS instant,
          ARRAY['2026-05-01T10:00:00Z']::timestamptz[] AS instants,
          42::int AS answer,
          ARRAY['a', 'b']::text[] AS letters
      `);
      expect(rows[0].instant).toBeInstanceOf(Date);
      expect((rows[0].instant as Date).toISOString()).toBe('2026-05-01T10:00:00.000Z');
      expect(rows[0].instants[0]).toBeInstanceOf(Date);
      expect(rows[0].answer).toBe(42);
      expect(rows[0].letters).toEqual(['a', 'b']);
    });

  });
});
