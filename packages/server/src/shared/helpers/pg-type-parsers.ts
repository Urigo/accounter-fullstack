import pg from 'pg';

const { types } = pg;

/** OID of `date[]`, which `pg-types` does not list in `builtins`. */
const DATE_ARRAY_OID = 1182;
/** OID of `text[]`: its parser splits a Postgres array literal into strings, element by element. */
const TEXT_ARRAY_OID = 1009;

const keepDateString = (value: string) => value;
const parseDateStringArray = types.getTypeParser(
  TEXT_ARRAY_OID as Parameters<typeof types.getTypeParser>[0],
  'text',
);

/**
 * Type parsers for every Postgres connection the server opens (#1924, #4560).
 *
 * By default node-pg turns a `date` column into a JS `Date` at local midnight of the server
 * process. A `date` is a calendar day with no time and no timezone, and a `Date` is a point in
 * time, so that conversion ties the value to the server's timezone: serialize it (`toISOString`,
 * JSON) or read it in another zone and it moves to the neighbouring day.
 *
 * These parsers keep `date` (and `date[]`) values as the `yyyy-mm-dd` strings Postgres sends,
 * matching the `TimelessDateString` type pgtyped generates for them (see `typesOverrides` in
 * `pgconfig.json`). Every other type keeps node-pg's default parser.
 *
 * Pass this as the `types` option of every `pg.Pool` / `pg.Client` whose rows reach server code.
 */
export const pgTypeParsers: pg.CustomTypesConfig = {
  getTypeParser: ((oid: number, format?: 'text' | 'binary') => {
    if (format !== 'binary') {
      if (oid === types.builtins.DATE) {
        return keepDateString;
      }
      if (oid === DATE_ARRAY_OID) {
        return parseDateStringArray;
      }
    }
    return types.getTypeParser(oid, format);
  }) as pg.CustomTypesConfig['getTypeParser'],
};
