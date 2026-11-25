/**
 * Imports Payoneer account activity into Accounter (`uploadPayoneerTransactions`).
 *
 * Payoneer has no API for account holders (its APIs are for approved partners), and the web app's
 * own activity API only answers the web app. So the activity is captured in a signed-in browser
 * session and uploaded from a file:
 *
 * 1. Sign in at https://myaccount.payoneer.com, open Manage → Transactions, set the date range to
 *    cover what you want to import, and run `PAYONEER_CAPTURE_SNIPPET` (below) in the browser
 *    console. It opens every listed item, keeps the activity details the page loads for it, and
 *    downloads them as `payoneer-activity-<date>.json`.
 * 2. Upload the file:
 *
 *    ACCOUNTER_GRAPHQL_URL=https://<server>/graphql ACCOUNTER_API_KEY=<scraper api key> \
 *      yarn payoneer:import ~/Downloads/payoneer-activity-<date>.json
 *
 *    `--dry-run` prints the mapped mutation input instead of uploading it.
 *
 * Only completed (final) items are uploaded: an uploaded item is booked once and never updated.
 * Re-uploading is safe — known items are skipped, and differences on them are reported.
 *
 * The Payoneer account must exist as a `BANK_ACCOUNT` financial account of the uploading business,
 * with the Payoneer account holder ID (shown in the output) as its account number, and a tax
 * category for each currency it holds.
 */
/* eslint-disable no-console -- a CLI that reports to the terminal */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const PAYONEER_CAPTURE_SNIPPET = String.raw`
(async () => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const captured = [];
  const { open, send } = XMLHttpRequest.prototype;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__payoneerUrl = String(url);
    return open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', () => {
      if (this.__payoneerUrl.includes('getItemDetailsRawData')) {
        captured.push(JSON.parse(this.responseText));
      }
    });
    return send.apply(this, arguments);
  };
  const items = [];
  const rows = [...document.querySelectorAll('tbody tr')].filter(row => row.querySelector('td'));
  try {
    for (const row of rows) {
      const cell = row.querySelector('td:nth-child(2)') ?? row;
      const before = captured.length;
      cell.click();
      for (let i = 0; i < 40 && captured.length === before; i++) await sleep(250);
      if (captured.length === before) {
        console.warn('No details loaded for', cell.innerText);
        continue;
      }
      items.push({ listDescription: cell.innerText.trim(), details: captured[captured.length - 1] });
      document.querySelector('button[aria-label="Close"]')?.click();
      await sleep(500);
    }
  } finally {
    XMLHttpRequest.prototype.open = open;
    XMLHttpRequest.prototype.send = send;
  }
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'payoneer-activity-' + new Date().toISOString().slice(0, 10) + '.json';
  link.click();
  console.log('Captured ' + items.length + ' of ' + rows.length + ' Payoneer items');
})();
`;

type Nullable<T> = T | null | undefined;

/** The fields of a `getItemDetailsRawData` response the import reads. */
export type PayoneerActivityDetails = {
  activityMainData: {
    EntityId: string;
    ActivityItemId: string;
    ActivityTypeId: number;
    ActivityItemStatus?: Nullable<number>;
    ActivityDate: string;
    Currency: string;
    Amount: number;
    Fee?: Nullable<number>;
    Balance?: Nullable<number>;
    IsFinal?: Nullable<boolean>;
    UserDescription?: Nullable<string>;
    GLPSAccountNumber?: Nullable<string>;
  };
  activityDetails?: Nullable<{
    InitiatorName?: Nullable<string>;
    DisplayName?: Nullable<string>;
    PaymentDescription?: Nullable<string>;
    UserDescription?: Nullable<string>;
    PseudoAccount?: Nullable<string>;
    LoadId?: Nullable<string>;
    AccountNumber?: Nullable<string>;
    SourceAmount?: Nullable<number>;
    AmountLoaded?: Nullable<number>;
  }>;
};

export type PayoneerActivityExportItem = {
  listDescription: string;
  details: PayoneerActivityDetails;
};

/** Mirrors the server's `PayoneerTransactionInput`. */
export type PayoneerTransactionInput = {
  accountId: string;
  transactionId: string;
  activityType: number;
  status: number | null;
  activityDate: string;
  currency: string;
  amount: number;
  fee: number;
  balance: number | null;
  description: string;
  counterpartyName: string | null;
  paymentDescription: string | null;
  receivingAccount: string | null;
  transferId: string | null;
  targetAccount: string | null;
  grossAmount: number | null;
  amountSent: number | null;
  rawData: string;
};

export function isFinalPayoneerItem(item: PayoneerActivityExportItem): boolean {
  return item.details.activityMainData.IsFinal === true;
}

export function toPayoneerTransactionInput(
  item: PayoneerActivityExportItem,
): PayoneerTransactionInput {
  const main = item.details.activityMainData;
  const details = item.details.activityDetails ?? {};
  return {
    accountId: String(main.EntityId),
    transactionId: String(main.ActivityItemId),
    activityType: main.ActivityTypeId,
    status: main.ActivityItemStatus ?? null,
    activityDate: main.ActivityDate,
    currency: main.Currency,
    amount: main.Amount,
    // Payoneer reports the fee as negative on the main data and positive on some details; the
    // balance always carries it as a deduction
    fee: main.Fee ? -Math.abs(main.Fee) : 0,
    balance: main.Balance ?? null,
    description: item.listDescription,
    counterpartyName: details.InitiatorName ?? details.DisplayName ?? null,
    paymentDescription:
      details.PaymentDescription ?? details.UserDescription ?? main.UserDescription ?? null,
    receivingAccount: details.PseudoAccount ?? main.GLPSAccountNumber ?? null,
    transferId: details.LoadId ?? null,
    targetAccount: details.AccountNumber ?? null,
    grossAmount: details.SourceAmount ?? null,
    amountSent: details.AmountLoaded ?? null,
    rawData: JSON.stringify(item.details),
  };
}

const UPLOAD_PAYONEER = /* GraphQL */ `
  mutation UploadPayoneerTransactions($transactions: [PayoneerTransactionInput!]!) {
    uploadPayoneerTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

async function main(argv: string[]) {
  const dryRun = argv.includes('--dry-run');
  const file = argv.find(arg => !arg.startsWith('--'));
  if (!file) {
    console.error('Usage: yarn payoneer:import <payoneer-activity.json> [--dry-run]');
    process.exit(1);
  }

  const items = JSON.parse(await readFile(file, 'utf8')) as PayoneerActivityExportItem[];
  const pending = items.filter(item => !isFinalPayoneerItem(item));
  for (const item of pending) {
    console.warn(`Skipping item not final yet: ${item.listDescription}`);
  }
  const transactions = items.filter(isFinalPayoneerItem).map(toPayoneerTransactionInput);
  const accounts = [...new Set(transactions.map(t => t.accountId))];
  console.log(
    `${transactions.length} completed item(s) for Payoneer account(s) ${accounts.join(', ')}`,
  );

  if (dryRun) {
    console.log(JSON.stringify(transactions, null, 2));
    return;
  }

  const url = process.env.ACCOUNTER_GRAPHQL_URL;
  const apiKey = process.env.ACCOUNTER_API_KEY;
  if (!url || !apiKey) {
    console.error('Set ACCOUNTER_GRAPHQL_URL and ACCOUNTER_API_KEY (a scraper API key)');
    process.exit(1);
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ query: UPLOAD_PAYONEER, variables: { transactions } }),
  });
  const body = (await response.json()) as { data?: unknown; errors?: unknown };
  if (!response.ok || body.errors) {
    console.error(JSON.stringify(body.errors ?? body, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(body.data, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main(process.argv.slice(2));
}
