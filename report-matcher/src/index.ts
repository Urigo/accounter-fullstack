import { readFileSync } from 'node:fs';
import { format } from 'date-fns';
import { LedgerForKovetzAchidDocument, type LedgerForKovetzAchidQuery } from 'gql/graphql.js';
import { print, type ExecutionResult } from 'graphql';
import { AccountingMovement } from 'report-handler/accounting-movements.js';
import { checkAccountsMatch } from 'report-handler/utils.js';
import { ReportHandler } from './report-handler/report.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
/* GraphQL */ `
query LedgerForKovetzAchid($page: Int, $limit: Int, $filters: ChargeFilter) {
    allCharges(page: $page, limit: $limit, filters: $filters) {
        nodes {
            id
            owner {
                __typename
                id
            }
            metadata {
                transactionsCount
                documentsCount
            }
            accountantApproval {
                approved
            }
            totalAmount {
                raw
                formatted
                currency
            }
            minEventDate
            minDocumentsDate
            userDescription
            validationData {
                missingInfo
            }
            counterparty {
                name
                id
            }
            ledgerRecords {
                __typename
                ... on LedgerRecords {
                    records {
                        id
                        creditAccount1 {
                            __typename
                            id
                            name
                        }
                        creditAccount2 {
                            __typename
                            id
                            name
                        }
                        creditAmount1 {
                            raw
                            currency
                        }
                        creditAmount2 {
                            raw
                            currency
                        }
                        debitAccount1 {
                            __typename
                            id
                            name
                        }
                        debitAccount2 {
                            __typename
                            id
                            name
                        }
                        debitAmount1 {
                            raw
                            currency
                        }
                        debitAmount2 {
                            raw
                            currency
                        }
                        description
                        invoiceDate
                        localCurrencyCreditAmount1 {
                            raw
                        }
                        localCurrencyCreditAmount2 {
                            raw
                        }
                        localCurrencyDebitAmount1 {
                            raw
                        }
                        localCurrencyDebitAmount2 {
                            raw
                        }
                        reference1
                        valueDate
                    }
                }
            }
            tags {
                name
            }
            vat {
                raw
                formatted
            }
            taxCategory {
                id
                name
            }
        }
        pageInfo {
            totalPages
        }
    }
}`;

function decodeReport(): ReportHandler {
  const originalFile = readFileSync('./BKMVDATA.txt', 'latin1');
  const translatedFile = transalateUnicode(originalFile);
  return new ReportHandler(translatedFile);
}

function transalateUnicode(rawFile: string): string {
  const hebrewChars = [
    'א',
    'ב',
    'ג',
    'ד',
    'ה',
    'ו',
    'ז',
    'ח',
    'ט',
    'י',
    'כ',
    'ל',
    'מ',
    'נ',
    'ס',
    'ע',
    'פ',
    'צ',
    'ק',
    'ר',
    'ש',
    'ת',
    'ך',
    'ם',
    'ן',
    'ף',
    'ץ',
  ];
  const gibberish = [
    'à',
    'á',
    'â',
    'ã',
    'ä',
    'å',
    'æ',
    'ç',
    'è',
    'é',
    'ë',
    'ì',
    'î',
    'ð',
    'ñ',
    'ò',
    'ô',
    'ö',
    '÷',
    'ø',
    'ù',
    'ú',
    'ê',
    'í',
    'ï',
    'ó',
    'õ',
  ];

  gibberish.map((char, i) => {
    rawFile = rawFile.replace(new RegExp(char, 'g'), hebrewChars[i]);
  });

  return rawFile;
}

async function fetchAccounterData(year: string) {
  const result = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // "operationName": "AllCharges",
      query: print(LedgerForKovetzAchidDocument),
      variables: {
        filters: {
          byOwners: ['6a20aa69-57ff-446e-8d6a-1e96d095e988'],
          fromAnyDate: `${year}-01-01`,
          sortBy: {
            asc: true,
            field: 'DATE',
          },
          toAnyDate: `${year}-12-31`,
        },
        limit: 9999,
        page: 1,
      },
    }),
  });
  return result.json() as Promise<ExecutionResult<LedgerForKovetzAchidQuery>>;
}

function filterMatches(
  accountingMovements: AccountingMovement[],
  ledgerRecord: LedgerRecord,
  account: 'credit1' | 'credit2' | 'debit1' | 'debit2',
  setMatched: (serial: number) => void,
) {
  // consider missing accounts as a match
  let ledgerAccount: string | null | undefined = null;
  switch (account) {
    case 'credit1':
      ledgerAccount = ledgerRecord.creditAccount1.name;
      break;
    case 'credit2':
      ledgerAccount = ledgerRecord.creditAccount2?.name;
      break;
    case 'debit1':
      ledgerAccount = ledgerRecord.debitAccount1?.name;
      break;
    case 'debit2':
      ledgerAccount = ledgerRecord.debitAccount2?.name;
      break;
  }

  if (!ledgerAccount) {
    return true;
  }

  let ledgerAmount: number | null = null;
  switch (account) {
    case 'credit1':
      ledgerAmount = ledgerRecord.localCurrencyCreditAmount1
        ? Number(ledgerRecord.localCurrencyCreditAmount1.raw.toFixed(2))
        : null;
      break;
    case 'credit2':
      ledgerAmount = ledgerRecord.localCurrencyCreditAmount2
        ? Number(ledgerRecord.localCurrencyCreditAmount2.raw.toFixed(2))
        : null;
      break;
    case 'debit1':
      ledgerAmount = ledgerRecord.localCurrencyDebitAmount1
        ? Number(ledgerRecord.localCurrencyDebitAmount1.raw.toFixed(2))
        : null;
      break;
    case 'debit2':
      ledgerAmount = ledgerRecord.localCurrencyDebitAmount2
        ? Number(ledgerRecord.localCurrencyDebitAmount2.raw.toFixed(2))
        : null;
      break;
  }

  const isCredit = account === 'credit1' || account === 'credit2';

  const filteredMovements = accountingMovements.filter(movement => {
    const amountsMatch = movement.amount === ledgerAmount;
    const sidesMatch = isCredit ? movement.side === 'credit' : movement.side === 'debit';
    const accountsMatch = checkAccountsMatch(movement.accountInMovement, ledgerAccount as string);
    return amountsMatch && sidesMatch && accountsMatch;
  });

  filteredMovements.filter(movement =>
    checkAccountsMatch(movement.accountInMovement, ledgerAccount as string),
  );
  if (filteredMovements.length === 1) {
    // TODO: add more validations
    setMatched(accountingMovements[0].serial);
    return true;
  }
  if (filteredMovements.length > 1) {
    console.warn(
      `Found ${filteredMovements.length} matches for record ${ledgerRecord.id} in charge ${ledgerRecord.id}`,
    );
    return false;
  }

  // case no movements found
  console.warn(`Could not find match for record ${ledgerRecord.id} in charge ${ledgerRecord.id}`);
  return false;
}

async function main() {
  const report = decodeReport().getReport();
  const accountingMovements = report.accountingMovements;

  if (!accountingMovements) {
    throw new Error('Could not find accounting movements');
  }

  const year = accountingMovements?.getMovements()?.[0]?.date.slice(0, 4);
  if (!year) {
    throw new Error('Could not find year');
  }
  const accounterData = await fetchAccounterData(year);
  const charges = accounterData.data?.allCharges?.nodes ?? [];

  const accounterMatched = new Map<
    string,
    { [key: number]: { credit1: boolean; credit2: boolean; debit1: boolean; debit2: boolean } }
  >();
  for (const charge of charges) {
    if (
      !charge.ledgerRecords ||
      !('records' in charge.ledgerRecords) ||
      !charge.ledgerRecords?.records?.length
    ) {
      accounterMatched.set(charge.id, {});
      continue;
    }
    const chargeMatches: {
      [key: number]: { credit1: boolean; credit2: boolean; debit1: boolean; debit2: boolean };
    } = {};

    charge.ledgerRecords.records.map((record, i) => {
      function setMatched(serial: number) {
        accountingMovements?.setMatch(serial, `${charge.id}|${i}`);
      }

      const possibleMatches = accountingMovements.getMovementsByValueDate(
        format(new Date(record.valueDate), 'yyyyMMdd'),
        { unmatchedOnly: true },
      );
      if (possibleMatches.length === 0) {
        console.warn(
          `Could not find possible matches for record ${record.id} in charge ${charge.id}`,
        );
        chargeMatches[i] = {
          credit1: false,
          credit2: false,
          debit1: false,
          debit2: false,
        };
      } else {
        chargeMatches[i] = {
          credit1: filterMatches(possibleMatches, record, 'credit1', setMatched),
          credit2: filterMatches(possibleMatches, record, 'credit2', setMatched),
          debit1: filterMatches(possibleMatches, record, 'debit1', setMatched),
          debit2: filterMatches(possibleMatches, record, 'debit2', setMatched),
        };
      }
    });
    accounterMatched.set(charge.id, chargeMatches);
  }

  console.log('here!');
}

type LedgerRecord = Extract<
  LedgerForKovetzAchidQuery['allCharges']['nodes'][number]['ledgerRecords'],
  { records: Array<unknown> }
>['records'][number];

main();
