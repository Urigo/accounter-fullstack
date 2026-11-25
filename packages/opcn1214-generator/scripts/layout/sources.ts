import { readdirSync, readFileSync } from 'node:fs';
import { parseCsvRecords, type CsvRow } from './csv.js';

/** Parsed CSV rows of one year's layout directory. */
export interface LayoutSources {
  records: CsvRow[];
  fields: CsvRow[];
  codes: CsvRow[];
  countries: CsvRow[];
}

const LAYOUT_DATA_DIR = new URL('../../documentation/layout/', import.meta.url);

/** Tax years that have a documentation/layout/<year>/ directory, ascending. */
export function layoutYears(): number[] {
  return readdirSync(LAYOUT_DATA_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map(entry => Number(entry.name))
    .sort((a, b) => a - b);
}

/** The newest tax year with a layout directory (source of the year-independent code unions). */
export function latestLayoutYear(): number {
  const year = layoutYears().at(-1);
  if (year === undefined) {
    throw new Error('layout: no documentation/layout/<year>/ directory');
  }
  return year;
}

/** Reads and parses documentation/layout/<year>/{records,fields,codes,countries}.csv. */
export function readLayoutSources(year: number): LayoutSources {
  const read = (file: string) =>
    parseCsvRecords(readFileSync(new URL(`${year}/${file}`, LAYOUT_DATA_DIR), 'utf8'));
  return {
    records: read('records.csv'),
    fields: read('fields.csv'),
    codes: read('codes.csv'),
    countries: read('countries.csv'),
  };
}

/** Location of the generated layout module of a year. */
export function layoutModuleUrl(year: number): URL {
  return new URL(`../../src/layout/${year}/layout.generated.ts`, import.meta.url);
}

/** Location of the generated, year-independent code unions module. */
export function codesModuleUrl(): URL {
  return new URL('../../src/model/codes.generated.ts', import.meta.url);
}
