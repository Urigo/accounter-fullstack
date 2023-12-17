import { cleanField } from './utils.js';

export type AccountingMovement = {
  serial: number;
  osekNumber: string;
  movementNumber: number;
  lineNumberInMovement: number;
  Mana: number;
  movementType: string;
  reference: string;
  referenceDocumentType: number;
  reference2: string;
  referenceDocumentType2: number;
  details: string;
  date: string;
  valueDate: string;
  accountInMovement: string;
  counterAccount: string;
  side: 'credit' | 'debit';
  currency: string;
  amount: number;
  foreignAmount: number;
  quantityField: number;
  matchingField1: string;
  matchingField2: string;
  branchId: string;
  entryDate: string;
  executor: string;
  misc: string;
};

type Filters = {
  unmatchedOnly?: boolean;
};

export class AccountingMovementsMap {
  private accountingMovements: AccountingMovement[];
  private movements = new Map<number, { data: AccountingMovement; matched: false | string }>();
  private dateMap = new Map<string, number[]>();
  private valueDateMap = new Map<string, number[]>();
  private amountMap = new Map<number, number[]>();
  private accountNameMap = new Map<string, number[]>();
  private currencyMap = new Map<string, number[]>();

  private getMovementSide(side: string): 'credit' | 'debit' {
    if (side === '1') {
      return 'debit';
    }
    if (side === '2') {
      return 'credit';
    }
    throw new Error(`Invalid movement side: ${side}`);
  }

  constructor(rawLines: Array<string>) {
    this.accountingMovements = rawLines.map((line): AccountingMovement => {
      const movement: AccountingMovement = {
        serial: Number(line.substring(4, 13)),
        osekNumber: cleanField(line.substring(13, 22)),
        movementNumber: Number(line.substring(22, 32)),
        lineNumberInMovement: Number(line.substring(32, 37)),
        Mana: Number(line.substring(37, 45)),
        movementType: cleanField(line.substring(45, 60)),
        reference: cleanField(line.substring(60, 80), true),
        referenceDocumentType: Number(line.substring(80, 83)),
        reference2: cleanField(line.substring(83, 103), true),
        referenceDocumentType2: Number(line.substring(103, 106)),
        details: cleanField(line.substring(106, 156)),
        date: cleanField(line.substring(156, 164)),
        valueDate: cleanField(line.substring(164, 172)),
        accountInMovement: cleanField(line.substring(172, 187)),
        counterAccount: cleanField(line.substring(187, 202)),
        side: this.getMovementSide(line[202]),
        currency: cleanField(line.substring(203, 206)),
        amount: Number(`${line.substring(206, 219)}.${line.substring(219, 221)}`),
        foreignAmount: Number(`${line.substring(221, 234)}.${line.substring(234, 236)}`),
        quantityField: Number(line.substring(236, 248)),
        matchingField1: cleanField(line.substring(248, 258), true),
        matchingField2: cleanField(line.substring(258, 268), true),
        branchId: cleanField(line.substring(268, 275), true),
        entryDate: cleanField(line.substring(275, 283)),
        executor: cleanField(line.substring(283, 292)),
        misc: cleanField(line.substring(292, 317)),
      };
      this.movements.set(movement.serial, { data: movement, matched: false });
      // Add to dateMap
      if (!this.dateMap.has(movement.date)) {
        this.dateMap.set(movement.date, []);
      }
      this.dateMap.get(movement.valueDate)?.push(movement.serial);
      // Add to valueDateMap
      if (!this.valueDateMap.has(movement.valueDate)) {
        this.valueDateMap.set(movement.valueDate, []);
      }
      this.valueDateMap.get(movement.valueDate)?.push(movement.serial);
      // Add to amountMap
      if (!this.amountMap.has(movement.amount)) {
        this.amountMap.set(movement.amount, []);
      }
      this.amountMap.get(movement.amount)?.push(movement.serial);
      // Add to accountNameMap
      if (!this.accountNameMap.has(movement.accountInMovement)) {
        this.accountNameMap.set(movement.accountInMovement, []);
      }
      this.amountMap.get(movement.amount)?.push(movement.serial);
      // Add to currencyMap
      if (!this.currencyMap.has(movement.currency)) {
        this.currencyMap.set(movement.currency, []);
      }
      this.currencyMap.get(movement.currency)?.push(movement.serial);

      return movement;
    });
  }

  public getMovements(): AccountingMovement[] {
    return this.accountingMovements;
  }

  public getMovementsByDate(date: string, filters?: Filters): AccountingMovement[] {
    const serials = this.dateMap.get(date);
    if (!serials) {
      return [];
    }
    return this.getMovementsBySerials(serials, filters);
  }

  public getMovementsByValueDate(valueDate: string, filters?: Filters): AccountingMovement[] {
    const serials = this.valueDateMap.get(valueDate);
    if (!serials) {
      return [];
    }
    return this.getMovementsBySerials(serials, filters);
  }

  public getMovementsByAccount(accountName: string, filters?: Filters): AccountingMovement[] {
    const serials = this.accountNameMap.get(accountName);
    if (!serials) {
      return [];
    }
    return this.getMovementsBySerials(serials, filters);
  }

  public getMovementsByAmount(amount: number, filters?: Filters): AccountingMovement[] {
    const serials = this.amountMap.get(amount);
    if (!serials) {
      return [];
    }
    return this.getMovementsBySerials(serials, filters);
  }

  public getMovementsByCurrency(currency: string, filters?: Filters): AccountingMovement[] {
    const serials = this.currencyMap.get(currency);
    if (!serials) {
      return [];
    }
    return this.getMovementsBySerials(serials, filters);
  }

  public getMovementBySerial(serial: number): AccountingMovement | undefined {
    return this.movements.get(serial)?.data;
  }

  private getMovementsBySerials(serials: number[], filters: Filters = {}): AccountingMovement[] {
    return serials
      .map(serial => this.movements.get(serial))
      .filter(
        movement =>
          movement !== undefined && (filters.unmatchedOnly !== true || movement.matched === false),
      )
      .map(movement => movement!.data) as AccountingMovement[];
  }

  public getMatch(serial: number) {
    const movement = this.movements.get(serial);
    if (!movement) {
      throw new Error(`Could not find movement with serial ${serial}`);
    }
    return movement.matched === false ? undefined : movement.matched;
  }

  public getMatchedData() {
    const movements = Array.from(this.movements);

    const movementsMap: Record<number, string | undefined> = {};
    movements.map(([movementSerial, { matched }]) => {
      movementsMap[movementSerial] = matched === false ? undefined : matched;
    });

    return movementsMap;
  }

  public setMatch(serial: number, match: string) {
    const movement = this.movements.get(serial);
    if (!movement) {
      throw new Error(`Could not find movement with serial ${serial}`);
    }
    movement.matched = match;
  }
}
