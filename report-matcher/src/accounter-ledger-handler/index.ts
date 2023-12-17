import { Currency, LedgerForKovetzAchidDocument, LedgerForKovetzAchidQuery } from 'gql/graphql.js';
import { ExecutionResult, print } from 'graphql';
import type { LedgerRecord, SubLedger } from 'types.js';

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

export type Charge = LedgerForKovetzAchidQuery['allCharges']['nodes'][number];

export class ChargesHandler {
  private chargesMap: Map<string, Charge> = new Map();
  private ledgerRecordsMap: Map<string, LedgerRecord[]> = new Map();
  private subLedgerRecordsMap: Map<string, SubLedger[]> = new Map();
  private SubLedgerRecordMatch: Map<string, number> = new Map();

  constructor(private charges: Array<Charge>) {
    for (const charge of charges) {
      this.chargesMap.set(charge.id, charge);
      if (!charge.ledgerRecords || !('records' in charge.ledgerRecords)) {
        continue;
      }
      charge.ledgerRecords.records.map((record, i) => {
        if (!record.id || record.id === '') {
          record.id = `${charge.id}|${i}`;
        }
        const subLedgerRecords: SubLedger[] = [];
        (['credit1', 'credit2', 'debit1', 'debit2'] as const).map(account => {
          const subRecord = this.generateSubLedgerRecord(record, account);
          if (subRecord) {
            subLedgerRecords.push(subRecord);
          }
        });
        this.subLedgerRecordsMap.set(record.id, subLedgerRecords);
      });
      this.ledgerRecordsMap.set(charge.id, charge.ledgerRecords.records);
    }
  }

  private generateSubLedgerRecord(
    ledgerRecord: LedgerRecord,
    account: 'credit1' | 'credit2' | 'debit1' | 'debit2',
  ): SubLedger | null {
    // consider missing accounts as a match
    let ledgerAccount: SubLedger['account'] | null | undefined = null;
    switch (account) {
      case 'credit1':
        ledgerAccount = ledgerRecord.creditAccount1;
        break;
      case 'credit2':
        ledgerAccount = ledgerRecord.creditAccount2;
        break;
      case 'debit1':
        ledgerAccount = ledgerRecord.debitAccount1;
        break;
      case 'debit2':
        ledgerAccount = ledgerRecord.debitAccount2;
        break;
    }

    if (!ledgerAccount) {
      return null;
    }

    let localCurrencyAmount: number | null = null;
    let currency: Currency | null = null;
    let amount: number | null = null;
    switch (account) {
      case 'credit1':
        localCurrencyAmount = ledgerRecord.localCurrencyCreditAmount1
          ? Number(ledgerRecord.localCurrencyCreditAmount1.raw.toFixed(2))
          : null;
        currency = ledgerRecord.creditAmount1 ? ledgerRecord.creditAmount1.currency : null;
        amount = ledgerRecord.creditAmount1
          ? Number(ledgerRecord.creditAmount1.raw.toFixed(2))
          : null;
        break;
      case 'credit2':
        localCurrencyAmount = ledgerRecord.localCurrencyCreditAmount2
          ? Number(ledgerRecord.localCurrencyCreditAmount2.raw.toFixed(2))
          : null;
        currency = ledgerRecord.creditAmount2 ? ledgerRecord.creditAmount2.currency : null;
        amount = ledgerRecord.creditAmount2
          ? Number(ledgerRecord.creditAmount2.raw.toFixed(2))
          : null;
        break;
      case 'debit1':
        localCurrencyAmount = ledgerRecord.localCurrencyDebitAmount1
          ? Number(ledgerRecord.localCurrencyDebitAmount1.raw.toFixed(2))
          : null;
        currency = ledgerRecord.debitAmount1 ? ledgerRecord.debitAmount1.currency : null;
        amount = ledgerRecord.debitAmount1
          ? Number(ledgerRecord.debitAmount1.raw.toFixed(2))
          : null;
        break;
      case 'debit2':
        localCurrencyAmount = ledgerRecord.localCurrencyDebitAmount2
          ? Number(ledgerRecord.localCurrencyDebitAmount2.raw.toFixed(2))
          : null;
        currency = ledgerRecord.debitAmount2 ? ledgerRecord.debitAmount2.currency : null;
        amount = ledgerRecord.debitAmount2
          ? Number(ledgerRecord.debitAmount2.raw.toFixed(2))
          : null;
        break;
    }

    const isCredit = account === 'credit1' || account === 'credit2';

    return {
      ...ledgerRecord,
      id: `${ledgerRecord.id}|${account}`,
      account: ledgerAccount,
      localCurrencyAmount,
      currency,
      amount,
      isCredit,
    };
  }

  public getLedgerRecords(chargeId: string) {
    return this.ledgerRecordsMap.get(chargeId);
  }

  public getSubLedgerRecords(recordId: string) {
    return this.subLedgerRecordsMap.get(recordId);
  }

  public getSubLedgerRecordsByChargeId(chargeId: string) {
    const ledgerRecords = this.getLedgerRecords(chargeId);
    return ledgerRecords?.map(record => this.getSubLedgerRecords(record.id) ?? []).flat(2);
  }

  public getUnmatchedSubLedgerRecordsByChargeId(chargeId: string) {
    const ledgerRecords = this.getLedgerRecords(chargeId);
    return ledgerRecords
      ?.map(
        record =>
          this.getSubLedgerRecords(record.id)?.filter(
            sub => !this.SubLedgerRecordMatch.has(sub.id),
          ) ?? [],
      )
      .flat(2);
  }

  public isChargeMatched(chargeId: string) {
    const subRecords = this.getSubLedgerRecordsByChargeId(chargeId);
    if (!subRecords) {
      return true;
    }
    return subRecords.every(record => this.SubLedgerRecordMatch.has(record.id));
  }

  public getSubRecordMatch(subRecordId: string) {
    return this.SubLedgerRecordMatch.get(subRecordId);
  }

  public setSubRecordMatch(subRecordId: string, movementSerial: number) {
    const current = this.SubLedgerRecordMatch.get(subRecordId);
    if (current) {
      console.warn(
        `Sub record ${subRecordId} already matched to movement ${current}, overriding with ${movementSerial}`,
      );
    }
    this.SubLedgerRecordMatch.set(subRecordId, movementSerial);
  }

  public getCharges() {
    return this.charges;
  }

  public getChargeById(id: string) {
    return this.charges.find(charge => charge.id === id);
  }
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

export async function getChargesHandler(year: string) {
  const accounterData = await fetchAccounterData(year);

  if (!accounterData.data?.allCharges?.nodes) {
    throw new Error('Could not find Accounter charges');
  }

  return new ChargesHandler(accounterData.data.allCharges.nodes);
}
