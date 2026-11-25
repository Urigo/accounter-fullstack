/**
 * Minimal RFC 4180 CSV parser for the layout data files (no dependency).
 *
 * Fields are separated by commas; a field may be wrapped in double quotes, in which case it may
 * contain commas, line breaks and doubled quotes (`""` → `"`). Rows end with CRLF or LF; a final
 * line break is optional. A leading UTF-8 byte order mark is skipped.
 */

export type CsvRow = Record<string, string>;

interface ParsedRow {
  /** 1-based physical line on which the row starts. */
  line: number;
  fields: string[];
}

function parseRows(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let fields: string[] = [];
  let field = '';
  let line = 1;
  let rowLine = 1;
  // Skip a UTF-8 BOM (Excel's "CSV UTF-8" adds one); it would otherwise prefix the first header.
  let i = text.startsWith('\uFEFF') ? 1 : 0;

  const endRow = () => {
    fields.push(field);
    rows.push({ line: rowLine, fields });
    fields = [];
    field = '';
  };

  while (i < text.length) {
    const char = text[i];
    if (char === '"' && field === '') {
      const quoteLine = line;
      i++;
      for (;;) {
        if (i >= text.length) {
          throw new Error(`CSV line ${quoteLine}: unterminated quoted field`);
        }
        const quoted = text[i];
        if (quoted === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        if (quoted === '\n') line++;
        field += quoted;
        i++;
      }
      const next = text[i];
      if (next !== undefined && next !== ',' && next !== '\n' && next !== '\r') {
        throw new Error(`CSV line ${line}: unexpected text after a closing quote`);
      }
      if (next === undefined) break;
      continue;
    }
    if (char === ',') {
      fields.push(field);
      field = '';
      i++;
      continue;
    }
    if (char === '\r' && text[i + 1] === '\n') {
      i++;
      continue;
    }
    if (char === '\n') {
      endRow();
      i++;
      line++;
      rowLine = line;
      continue;
    }
    field += char;
    i++;
  }

  if (field !== '' || fields.length > 0 || (text.length > 0 && !text.endsWith('\n'))) {
    endRow();
  }
  return rows;
}

/** Parses CSV text into rows of fields. */
export function parseCsv(text: string): string[][] {
  return parseRows(text).map(row => row.fields);
}

/**
 * Parses CSV text whose first row is a header into one object per data row, keyed by the header
 * names. Throws, naming the physical line, for a row whose column count differs from the header's.
 */
export function parseCsvRecords(text: string): CsvRow[] {
  const [header, ...rows] = parseRows(text);
  if (!header) {
    throw new Error('CSV: missing header row');
  }
  return rows.map(row => {
    if (row.fields.length !== header.fields.length) {
      throw new Error(
        `CSV line ${row.line}: expected ${header.fields.length} columns, got ${row.fields.length}`,
      );
    }
    return Object.fromEntries(header.fields.map((name, index) => [name, row.fields[index] ?? '']));
  });
}
