import { renderLayoutModule } from '../../scripts/layout/render.js';
import { readLayoutSources, type LayoutSources } from '../../scripts/layout/sources.js';

/** The 2024 sources with one column of one row replaced. */
function withCell(
  file: 'records' | 'fields',
  match: (row: Record<string, string>) => boolean,
  column: string,
  value: string,
): LayoutSources {
  const sources = readLayoutSources(2024);
  return {
    ...sources,
    [file]: sources[file].map(row => (match(row) ? { ...row, [column]: value } : row)),
  };
}

describe('renderLayoutModule CSV errors', () => {
  it('names the fields.csv row (record@position) of a bad cell', async () => {
    const sources = withCell(
      'fields',
      row => row['record'] === '1000' && row['position'] === '146',
      'specPage',
      '',
    );
    await expect(renderLayoutModule(2024, sources)).rejects.toThrow(
      'layout CSV (1000@146): column "specPage" must be a non-negative integer, got ""',
    );
  });

  it('names the fields.csv row of a value outside the allowed set', async () => {
    const sources = withCell(
      'fields',
      row => row['record'] === '1020' && row['position'] === '148',
      'type',
      'text',
    );
    await expect(renderLayoutModule(2024, sources)).rejects.toThrow(
      /^layout CSV \(1020@148\): column "type"/,
    );
  });

  it('names the fields.csv row of a malformed values cell', async () => {
    const sources = withCell(
      'fields',
      row => row['record'] === '1020' && row['position'] === '198',
      'values',
      'x=yes',
    );
    await expect(renderLayoutModule(2024, sources)).rejects.toThrow(
      /^layout CSV \(1020@198\): values: "x=yes" is not a non-negative integer/,
    );
  });

  it('names the records.csv row of a bad cell', async () => {
    const sources = withCell('records', row => row['record'] === '9999', 'maxOccurs', 'x');
    await expect(renderLayoutModule(2024, sources)).rejects.toThrow(
      'layout CSV (9999): column "maxOccurs" must be a non-negative integer, got "x"',
    );
  });
});
