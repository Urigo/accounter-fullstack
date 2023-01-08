import { parse } from 'csv-parse';

export type EtanaAccountTransaction = {
  transactionId: string;
  accountId: string;
  currency: string;
  time: Date;
  amount: number;
  description: string;
  transactionRef: string | null;
  ref: string | null;
  metadata: string;
  actionType: null | 'deposit' | 'withdrawal' | 'fee';
  raw: string[];
};

function parseRecord(input: string[]): EtanaAccountTransaction {
  const description = input[5] || '';
  const ref = description.includes('wire fee') ? description.split(': ')[1]?.trim() || null : null;
  const transactionRef = description.includes('Withdrawal: ')
    ? description.split(': ')[1]?.trim() || null
    : null;

  return {
    transactionId: input[0],
    accountId: input[1],
    currency: input[2],
    time: new Date(input[3]),
    amount: parseFloat(input[4]),
    description,
    transactionRef,
    ref,
    metadata: input[6],
    raw: input,
    actionType: description.includes('Withdrawal: ')
      ? 'withdrawal'
      : description.includes('Transfer from')
      ? 'deposit'
      : description.includes('Withdrawal fee')
      ? 'fee'
      : null,
  };
}

export function createEtana(options: { csvContent: string }) {
  const parser = parse(options.csvContent);

  return {
    accountTransactions() {
      return new Promise<EtanaAccountTransaction[]>((resolve, reject) => {
        const records: EtanaAccountTransaction[] = [];

        parser.on('readable', () => {
          let record: string[];
          while ((record = parser.read()) !== null) {
            // ignore heaeder
            if (!record || record[0] === 'tid') {
              continue;
            }

            records.push(parseRecord(record));
          }
        });
        parser.on('error', reject);
        parser.on('end', () => resolve(records));
      });
    },
  };
}
