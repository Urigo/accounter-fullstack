import { format, parse as parseDate } from 'date-fns';
import xlsx from 'node-xlsx';
import { type Page } from 'playwright';
import { OtsarHahayalOptions } from './index.js';
import {
  Currency,
  GroupedForeignTransaction,
  type ForeignAccountData,
  type ForeignTransaction,
  type TimelessDateString,
} from './types.js';

const CURRENCY_MAP: Record<string, Currency> = {
  'דולר ארה"ב': Currency.Usd,
  אירו: Currency.Eur,
};

// a function that strips the "," and " " from stringified numbers
function parseNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[, ]/g, '');
    const parsed = Number(cleaned);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  throw new Error(`Cannot parse number: ${raw}`);
}

function toTimelessDate(raw: unknown): TimelessDateString {
  if (typeof raw === 'number') {
    // Excel serial date — days since 1899-12-30
    const EXCEL_EPOCH_OFFSET = 25_569;
    const SECONDS_PER_DAY = 86_400;
    const date = new Date((raw - EXCEL_EPOCH_OFFSET) * SECONDS_PER_DAY * 1000);
    return format(date, 'yyyy-MM-dd') as TimelessDateString;
  }
  if (typeof raw === 'string') {
    return format(parseDate(raw, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd') as TimelessDateString;
  }
  throw new Error(`Cannot convert to date: ${raw}`);
}

function checkIfForeignSecuritiesOrDeposits(accountType: string): boolean {
  // Foreign securities (718)
  const match = accountType.match(/^(\d{3})/);
  switch (match?.[1]) {
    case '718':
      // future debit foreign securities USD
      return true;
    case '719':
      // future credit foreign securities USD
      return true;
    default:
      return false;
  }
}

function groupTransactions(transactions: ForeignTransaction[]): GroupedForeignTransaction[] {
  const groupedTransactions = new Map<string, GroupedForeignTransaction>();
  for (const transaction of transactions) {
    const key = `${transaction.valueDate}||${transaction.date}|${transaction.reference}|${transaction.description}`;
    if (!groupedTransactions.has(key)) {
      groupedTransactions.set(key, {
        balance: null,
        valueDate: transaction.valueDate,
        credit: 0,
        debit: 0,
        description: transaction.description,
        sp: transaction.sp,
        reference: transaction.reference,
        depositKey: transaction.depositKey,
        date: transaction.date,
        subTransactions: [],
      });
    }
    const group = groupedTransactions.get(key)!;
    if (group.balance && transaction.balance) {
      throw new Error('Cannot group transactions with different balances');
    }
    if (group.sp !== transaction.sp || group.depositKey !== transaction.depositKey) {
      throw new Error('Cannot group transactions with different SP or deposit keys');
    }
    group.balance ??= transaction.balance;
    group.credit += transaction.credit;
    group.credit = Math.round(group.credit * 100) / 100;
    group.debit += transaction.debit;
    group.debit = Math.round(group.debit * 100) / 100;
    group.subTransactions.push({
      credit: transaction.credit,
      debit: transaction.debit,
    });
  }

  return Array.from(groupedTransactions.values());
}

function parseForeignXls(buffer: Buffer): ForeignAccountData {
  const sheets = xlsx.parse<unknown[]>(buffer);
  const sheet = sheets[0];
  if (!sheet) throw new Error('XLS file has no sheets');
  const rows = sheet.data;

  // Row index 2 (0-based): "חשבון: 123-456789"
  const metaRow = String(rows[2]?.[0] ?? '');
  const accountMatch = metaRow.match(/חשבון:\s*(\d+)-(\d+)/);

  // Row index 3 (0-based): "סוג חשבון: 123 סוג כלשהו  מטבע: דולר ארה"ב"
  const metaRow2 = String(rows[3]?.[0] ?? '');
  const accountTypeMatch = metaRow2.match(/סוג חשבון:\s*(.+?)\s*מטבע:/);
  const currencyMatch = metaRow2.match(/מטבע:\s*(.+)$/);

  const branch = accountMatch?.[1] ? Number(accountMatch[1]) : 0;
  const account = accountMatch?.[2] ? Number(accountMatch[2]) : 0;
  const accountType = accountTypeMatch?.[1]?.trim() ?? '';
  const currencyLabel = currencyMatch?.[1]?.trim() ?? '';
  const currency = CURRENCY_MAP[currencyLabel] ?? Currency.Usd;

  // Row index 6 (0-based): opening balance row — יתרת פתיחה in col E(4), balance in col A(0)
  const openingRow = rows[6];
  const openingBalance = parseNumber(openingRow?.[1] ?? 0);

  const isForeignSecuritiesOrDeposits = checkIfForeignSecuritiesOrDeposits(accountType);

  // Rows from index 7 onward are transactions
  // Columns (0-based, RTL stored as LTR in XLS):
  // 0=יתרה(balance), 1=ערך(valueDate), 2=זכות(credit), 3=חובה(debit),
  // 4=תאור פעולה(description), 5=פ.ס.(sp), 6=אסמכתא(reference), 9=תאריך(date)
  const transactions: ForeignTransaction[] = [];
  for (const row of rows.slice(7)) {
    if (!row || row.length === 0) continue;
    const date = isForeignSecuritiesOrDeposits ? row[9] : row[8];
    if (date == null) continue;

    transactions.push({
      balance: String(row[1] ?? '').trim() === '' ? null : parseNumber(row[1]),
      valueDate: toTimelessDate(row[2]),
      credit: parseNumber(row[3] ?? 0),
      debit: parseNumber(row[4] ?? 0),
      description: String(row[5] ?? '').trim(),
      sp: row[6] != null && Number(row[6]) !== 0 ? Number(row[6]) : null,
      reference: String(row[7] ?? '').trim(),
      depositKey: isForeignSecuritiesOrDeposits ? String(row[8] ?? '').trim() : null,
      date: toTimelessDate(date),
    });
  }

  const groupedTransactions = groupTransactions(transactions);

  return {
    metadata: { account, branch, accountType, currency, openingBalance },
    transactions: groupedTransactions,
  };
}

export async function getForeignTransactions(page: Page, options: OtsarHahayalOptions) {
  const startDate = format(
    options.fromDate
      ? new Date(options.fromDate)
      : new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
    'dd/MM/yyyy',
  );
  const endDate = format(options.toDate ? new Date(options.toDate) : new Date(), 'dd/MM/yyyy');
  await page.goto(
    'https://online.bankotsar.co.il/appsng/Resources/PortalNG/shell/#/Online/OnForeignCurrency/OnCurrentAccountFC/AuthFCCurrentMovements',
  );

  // get frame "#iframe-old-pages"
  const frame = page.frameLocator('#iframe-old-pages');
  if (!frame) {
    throw new Error('Could not find frame #iframe-old-pages');
  }

  // wait for selector "#IN-SCH-MTB" to appear in the frame
  await frame.locator('#IN-SCH-MTB').waitFor();

  // extract selector options (foreign accounts)
  const foreignAccounts = await frame.locator('#IN-SCH-MTB option').evaluateAll(options =>
    options.map(option => ({
      value: (option as HTMLOptionElement).value,
      label: (option as HTMLOptionElement).text.trim(),
    })),
  );

  const results: ForeignAccountData[] = [];

  for (const foreignAccount of foreignAccounts) {
    await frame.locator('#IN-SCH-MTB').selectOption(foreignAccount.value);
    await frame.locator('#fromDate').fill(startDate);
    await frame.locator('#tillDate').fill(endDate);

    await frame
      .locator(
        '#T40C1040 > table > tbody > tr:nth-child(8) > td > div > table > tbody > tr:nth-child(2) > td > input:nth-child(1)',
      )
      .click();

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await frame
      .locator(
        '#T40C1040 > table > tbody > tr:nth-child(8) > td > div > table > tbody > tr:nth-child(2) > td > input:nth-child(3)',
      )
      .click();
    const download = await downloadPromise;
    const xlsBuffer = await download.createReadStream().then(
      stream =>
        new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', reject);
        }),
    );

    // Close any popup tab that opened to serve the download so it doesn't
    // interfere with subsequent iterations
    for (const p of page.context().pages()) {
      if (p !== page) await p.close().catch(() => {});
    }

    results.push(parseForeignXls(xlsBuffer));
  }

  return results;
}
