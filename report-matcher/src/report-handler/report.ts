import { AccountingAccountsMap } from './accounting-accounts.js';
import { AccountingMovementsMap } from './accounting-movements.js';

type ReportType = {
  accountingMovements?: AccountingMovementsMap;
  accountingAccounts?: AccountingAccountsMap;
};

export class ReportHandler {
  private rawFile: string;
  private groupedLines: Map<string, string[]>;
  private report: ReportType;

  constructor(rawFile: string) {
    this.report = {};
    this.rawFile = rawFile;
    this.groupedLines = new Map<string, string[]>();

    this.decodeFile();
  }

  private decodeFile(): void {
    const lines = this.rawFile.split('\n');
    for (const line of lines) {
      const group = line.slice(0, 4);
      if (!this.groupedLines.has(group)) {
        this.groupedLines.set(group, []);
      }
      this.groupedLines.get(group)?.push(line);
    }
    const b100 = this.groupedLines.get('B100');
    if (b100?.length) {
      this.report.accountingMovements = new AccountingMovementsMap(b100);
    }

    const b110 = this.groupedLines.get('B110');
    if (b110?.length) {
      this.report.accountingAccounts = new AccountingAccountsMap(b110);
    }
  }

  getReport(): ReportType {
    return this.report;
  }
}
