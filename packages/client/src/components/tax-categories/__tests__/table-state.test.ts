import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_TAX_CATEGORIES_TABLE_STATE,
  parseTaxCategoriesTableState,
  taxCategoriesTableStateToSearchParams,
} from '../table-state.js';

/**
 * These params come off a pasted link, so every value is untrusted: a bad page
 * size would leave the pagination bar's `Select` blank, and an unknown column id
 * would put the table in a sort state its own headers cannot produce or undo.
 */

const parse = (query: string) => parseTaxCategoriesTableState(new URLSearchParams(query));

describe('parseTaxCategoriesTableState', () => {
  it('defaults an empty query string', () => {
    expect(parse('')).toStrictEqual(DEFAULT_TAX_CATEGORIES_TABLE_STATE);
  });

  it('reads a 1-based page as a 0-based index', () => {
    expect(parse('page=3').pagination.pageIndex).toBe(2);
  });

  it.each(['page=0', 'page=-1', 'page=1.5', 'page=abc', 'page='])('defaults %s', query => {
    expect(parse(query).pagination.pageIndex).toBe(0);
  });

  it('reads an offered page size', () => {
    expect(parse('pageSize=100').pagination.pageSize).toBe(100);
  });

  it.each(['pageSize=25', 'pageSize=0', 'pageSize=abc'])(
    'defaults %s, which the pagination bar does not offer',
    query => {
      expect(parse(query).pagination.pageSize).toBe(DEFAULT_PAGE_SIZE);
    },
  );

  it('reads sort direction', () => {
    expect(parse('sort=irsCode:desc').sorting).toStrictEqual([{ id: 'irsCode', desc: true }]);
    expect(parse('sort=name:asc').sorting).toStrictEqual([{ id: 'name', desc: false }]);
  });

  it('reads multiple sorted columns in order', () => {
    expect(parse('sort=sortCode:asc,name:desc').sorting).toStrictEqual([
      { id: 'sortCode', desc: false },
      { id: 'name', desc: true },
    ]);
  });

  it.each(['sort=nope:asc', 'sort=name:sideways', 'sort=name', 'sort=', 'sort=:asc'])(
    'drops %s',
    query => {
      expect(parse(query).sorting).toStrictEqual([]);
    },
  );

  it('keeps only the first entry for a repeated column', () => {
    expect(parse('sort=name:asc,name:desc').sorting).toStrictEqual([{ id: 'name', desc: false }]);
  });

  it('keeps the valid parts of a partly malformed query', () => {
    expect(parse('page=2&pageSize=999&sort=nope:asc')).toStrictEqual({
      pagination: { pageIndex: 1, pageSize: DEFAULT_PAGE_SIZE },
      sorting: [],
    });
  });
});

describe('taxCategoriesTableStateToSearchParams', () => {
  it('omits every default so an untouched table leaves the URL clean', () => {
    expect(taxCategoriesTableStateToSearchParams(DEFAULT_TAX_CATEGORIES_TABLE_STATE)).toStrictEqual(
      {},
    );
  });

  it('writes a 0-based index as a 1-based page', () => {
    expect(
      taxCategoriesTableStateToSearchParams({
        pagination: { pageIndex: 2, pageSize: DEFAULT_PAGE_SIZE },
        sorting: [],
      }),
    ).toStrictEqual({ page: '3' });
  });

  it('writes page size and sort', () => {
    expect(
      taxCategoriesTableStateToSearchParams({
        pagination: { pageIndex: 0, pageSize: 10 },
        sorting: [{ id: 'name', desc: true }],
      }),
    ).toStrictEqual({ pageSize: '10', sort: 'name:desc' });
  });

  it('round-trips through parse', () => {
    const state = {
      pagination: { pageIndex: 4, pageSize: 50 },
      sorting: [{ id: 'sortCode', desc: true }],
    };
    const params = new URLSearchParams(taxCategoriesTableStateToSearchParams(state));
    expect(parseTaxCategoriesTableState(params)).toStrictEqual(state);
  });
});
