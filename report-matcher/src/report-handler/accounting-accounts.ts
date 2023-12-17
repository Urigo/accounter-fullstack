import { cleanField } from './utils.js';

export type AccountingAccount = {
  serial: number;
  osekNumber: string;
  accountKey: string;
  accountName: string;
  trialBalanceKey: string;
  trialBalanceKeyDescription: string;
  supplierCustomerAddressStreet: string;
  supplierCustomerAddressHouseNumber: string;
  supplierCustomerAddressCity: string;
  supplierCustomerAddressZipCode: string;
  supplierCustomerAddressCountry: string;
  countryCode: string;
  centralizingAccount: string;
  accountBalanceAtFilterBeginning: number;
  totalDebit: number;
  totalCredit: number;
  accountingClassificationCode: number;
  supplierCustomerOsekNumber: string;
  branchId: string;
  foreignCurrencyBalanceAtFilterBeginning: number;
  foreignCurrencyBalanceAtFilterBeginningCurrency: string;
  misc: string;
};

export class AccountingAccountsMap {
  private accountingAccounts: AccountingAccount[];
  private accounts = new Map<number, AccountingAccount>();
  private nameMap = new Map<string, number>();
  private keyMap = new Map<string, number>();

  constructor(rawLines: Array<string>) {
    this.accountingAccounts = rawLines.map((line): AccountingAccount => {
      const account: AccountingAccount = {
        serial: Number(line.substring(4, 13)),
        osekNumber: cleanField(line.substring(13, 22)),
        accountKey: cleanField(line.substring(22, 37)),
        accountName: cleanField(line.substring(37, 87)),
        trialBalanceKey: cleanField(line.substring(87, 102)),
        trialBalanceKeyDescription: cleanField(line.substring(102, 132)),
        supplierCustomerAddressStreet: cleanField(line.substring(132, 182)),
        supplierCustomerAddressHouseNumber: cleanField(line.substring(182, 192)),
        supplierCustomerAddressCity: cleanField(line.substring(192, 222)),
        supplierCustomerAddressZipCode: cleanField(line.substring(222, 230)),
        supplierCustomerAddressCountry: cleanField(line.substring(230, 260)),
        countryCode: cleanField(line.substring(260, 262)),
        centralizingAccount: cleanField(line.substring(262, 277)),
        accountBalanceAtFilterBeginning: Number(
          `${line.substring(277, 290)}.${line.substring(290, 292)}`,
        ),
        totalDebit: Number(`${line.substring(292, 305)}.${line.substring(305, 307)}`),
        totalCredit: Number(`${line.substring(307, 320)}.${line.substring(320, 322)}`),
        accountingClassificationCode: Number(line.substring(322, 326)),
        supplierCustomerOsekNumber: cleanField(line.substring(326, 335)),
        branchId: cleanField(line.substring(335, 342)),
        foreignCurrencyBalanceAtFilterBeginning: Number(
          `${line.substring(342, 355)}.${line.substring(355, 357)}`,
        ),
        foreignCurrencyBalanceAtFilterBeginningCurrency: cleanField(line.substring(357, 360)),
        misc: cleanField(line.substring(360, 376)),
      };
      this.accounts.set(account.serial, account);
      // Add to nameMap
      if (this.nameMap.has(account.accountName)) {
        // throw new Error(`Duplicate account name: ${account.accountName}`)
      }
      this.nameMap.set(account.accountName, account.serial);
      // Add to keyMap
      if (this.keyMap.has(account.accountKey)) {
        throw new Error(`Duplicate account key: ${account.accountKey}`);
      }
      this.keyMap.set(account.accountKey, account.serial);

      return account;
    });
  }

  public getAccounts(): AccountingAccount[] {
    return this.accountingAccounts;
  }

  public getAccountsByName(name: string) {
    const serial = this.nameMap.get(name);
    if (!serial) {
      return [];
    }
    return this.getAccountBySerial(serial);
  }

  public getAccountsByKey(key: string) {
    const serial = this.keyMap.get(key);
    if (!serial) {
      return [];
    }
    return this.getAccountBySerial(serial);
  }

  public getAccountBySerial(serial: number): AccountingAccount | undefined {
    return this.accounts.get(serial);
  }
}
