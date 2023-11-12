import { readFileSync } from 'node:fs';
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

  constructor(path: string, encoding: BufferEncoding) {
    this.report = {};
    const originalFile = readFileSync(path, encoding);
    const translatedFile = this.translateUnicode(originalFile);
    this.rawFile = translatedFile;
    this.groupedLines = new Map<string, string[]>();

    this.decodeFile();
  }

  private translateUnicode(rawFile: string): string {
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
