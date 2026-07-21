import { describe, expect, it } from 'vitest';
import type { ChargeForCsvExportFieldsFragment } from '../../../gql/graphql.js';
import { convertChargesToCsv, escapeCsvField } from '../charges-csv.js';

describe('escapeCsvField', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsvField('hello')).toBe('hello');
    expect(escapeCsvField('')).toBe('');
  });

  it('quotes and escapes values containing commas, quotes, or newlines', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });
});

// Minimal charge fixture. `getFragmentData` is an identity function at runtime, so plain nested
// objects for transactions/documents are read correctly by the flattening helpers.
function makeCharge(
  overrides: Partial<ChargeForCsvExportFieldsFragment> = {},
): ChargeForCsvExportFieldsFragment {
  return {
    __typename: 'CommonCharge',
    id: 'charge-1',
    minEventDate: '2024-01-15',
    minDebitDate: '2024-01-20',
    minDocumentsDate: '2024-01-10',
    totalAmount: { raw: 1234.5, currency: 'ILS' },
    vat: { raw: 200 },
    counterparty: { id: 'cp-1', name: 'Acme Ltd' },
    userDescription: 'office supplies',
    tags: [{ id: 't1', name: 'office' }],
    taxCategory: { id: 'tc1', name: 'Expenses' },
    accountantApproval: 'PENDING',
    validationData: { isValid: false, missingInfo: ['DOCUMENTS', 'VAT'] },
    missingInfoSuggestions: { description: 'suggested', tags: [] },
    metadata: {
      transactionsCount: 1,
      documentsCount: 0,
      invoicesCount: 0,
      receiptsCount: 0,
      ledgerCount: 2,
      miscExpensesCount: 0,
      openDocuments: false,
      invalidLedger: 'VALID',
    },
    ledger: { balance: { isBalanced: true }, validate: { isValid: true, errors: [] } },
    transactions: [
      {
        id: 'tx-1',
        eventDate: '2024-01-15',
        amount: { raw: -1234.5, formatted: '-1,234.50 ₪' },
        account: { id: 'acc-1', name: 'Bank Hapoalim', type: 'BANK_ACCOUNT' },
        sourceDescription: 'card, purchase',
        referenceKey: 'REF1',
        counterparty: { id: 'cp-1', name: 'Acme Ltd' },
      },
    ],
    additionalDocuments: [],
    ...overrides,
  } as unknown as ChargeForCsvExportFieldsFragment;
}

describe('convertChargesToCsv', () => {
  it('emits a header row with the expected validation columns', () => {
    const csv = convertChargesToCsv([makeCharge()]);
    const [header] = csv.split('\r\n');
    for (const col of [
      'Charge ID',
      'Is Valid',
      'Missing Documents',
      'Missing VAT',
      'Ledger Status',
      'Transactions Detail',
      'Documents Detail',
    ]) {
      expect(header).toContain(col);
    }
  });

  it('maps validation data to per-type boolean columns', () => {
    const csv = convertChargesToCsv([makeCharge()]);
    const header = csv.split('\r\n')[0].split(',');
    const row = csv.split('\r\n')[1];
    // Naive split is unsafe for quoted cells, so assert via a parsed record instead.
    const record = parseCsvRow(row);
    const get = (key: string): string => record[header.indexOf(key)];

    expect(get('Is Valid')).toBe('No');
    expect(get('Missing Documents')).toBe('Yes');
    expect(get('Missing VAT')).toBe('Yes');
    expect(get('Missing Tags')).toBe('No');
    expect(get('Amount')).toBe('1234.50');
    expect(get('Currency')).toBe('ILS');
  });

  it('flattens transactions into a single quoted cell', () => {
    const csv = convertChargesToCsv([makeCharge()]);
    // The transaction sourceDescription contains a comma, so the detail cell must be quoted.
    expect(csv).toContain('"2024-01-15 | -1,234.50 ₪ | Bank Hapoalim | card, purchase | REF1 | Acme Ltd"');
  });

  it('produces one data row per charge', () => {
    const csv = convertChargesToCsv([makeCharge({ id: 'a' }), makeCharge({ id: 'b' })]);
    // header + 2 data rows (no cell contains a bare newline that starts a new record here besides
    // quoted multiline cells, which parseCsvRow-awareness is not needed for this count check).
    const records = splitCsvRecords(csv);
    expect(records).toHaveLength(3);
  });
});

// --- tiny RFC-4180-aware helpers for assertions (test-only) ---

function splitCsvRecords(csv: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (!inQuotes && char === '\r' && csv[i + 1] === '\n') {
      records.push(current);
      current = '';
      i++;
    } else {
      current += char;
    }
  }
  if (current !== '') {
    records.push(current);
  }
  return records;
}

function parseCsvRow(row: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}
