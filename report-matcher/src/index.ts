import { readFileSync } from 'node:fs';
import { format } from 'date-fns';
import { LedgerForKovetzAchidDocument, type LedgerForKovetzAchidQuery } from 'gql/graphql.js';
import { print, type ExecutionResult } from 'graphql';
import { AccountingMovementsMap } from 'report-handler/accounting-movements.js';
import { ReportHandler } from './report-handler/report.js';
import { filterMatches } from 'filter-utils/index.js';
import { validateMatches } from 'match-validation.js';

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
  const translatedFile = translateUnicode(originalFile);
  return new ReportHandler(translatedFile);
}

function translateUnicode(rawFile: string): string {
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

function getReportAccountingMovements(): AccountingMovementsMap {
  const report = decodeReport().getReport();
  const accountingMovements = report.accountingMovements;

  if (!accountingMovements) {
    throw new Error('Could not find accounting movements');
  }

  return accountingMovements;
}

function getYearFromMovements(accountingMovements: AccountingMovementsMap): string {
  const year = accountingMovements.getMovements()?.[0]?.date.slice(0, 4);

  if (!year) {
    throw new Error('Could not find year');
  }

  return year;
}

type Charge = LedgerForKovetzAchidQuery['allCharges']['nodes'][number]

async function getAccounterChargesByYear(year: string): Promise<Array<Charge>> {
  const accounterData = await fetchAccounterData(year);

  if (!accounterData.data?.allCharges?.nodes) {
    throw new Error('Could not find Accounter charges');
  }

  return accounterData.data.allCharges.nodes;
}

async function main() {
  const accountingMovements = getReportAccountingMovements();

  const year = getYearFromMovements(accountingMovements);

  const charges = await getAccounterChargesByYear(year);

  const accounterMatched = new Map<
    string,
    { [ledgerIndex: number]: { credit1: boolean; credit2: boolean; debit1: boolean; debit2: boolean } }
  >();
  for (const charge of charges) {
 
    // case no ledger records
    if (
      !charge.ledgerRecords ||
      !('records' in charge.ledgerRecords) ||
      !charge.ledgerRecords?.records?.length
    ) {
      accounterMatched.set(charge.id, {});
      continue;
    }

    // handle match search
    const chargeMatches: {
      [ledgerIndex: number]: { credit1: boolean; credit2: boolean; debit1: boolean; debit2: boolean };
    } = {};

    charge.ledgerRecords.records.map((record, i) => {
      if (!record.id || record.id === '') {
        record.id = `${charge.id}|${i}`;
      }

      function setMatched(serial: number) {
        accountingMovements?.setMatch(serial, `${charge.id}|${i}`);
      }

      function possibleMatches() {
        return accountingMovements.getMovementsByValueDate(
          format(new Date(record.valueDate), 'yyyyMMdd'),
          { unmatchedOnly: true },
        );
      }
      if (possibleMatches().length === 0) {
        console.warn(
          `Could not find possible matches for record ${record.id} in charge ${charge.id}`,
        );
        chargeMatches[i] = {
          credit1: !record.creditAccount1,
          credit2: !record.creditAccount2,
          debit1: !record.debitAccount1,
          debit2: !record.debitAccount2,
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

  for (const [chargeId, matches] of accounterMatched.entries()) {
    for (const [recordIndex, match] of Object.entries(matches)) {
      if (
        match.credit1 === false ||
        match.credit2 === false ||
        match.debit1 === false ||
        match.debit2 === false
      ) {
        console.log(`Charge ${chargeId} record ${recordIndex} does not match`);
      }
    }
  };

  // log match success rate
  const matchedData = accountingMovements.getMatchedData()
  console.log(`${Object.values(matchedData).filter(value => !!value).length * 100 / Object.keys(matchedData).length}% of movements matched`);

  validateMatches(matchedData);
}

main();
