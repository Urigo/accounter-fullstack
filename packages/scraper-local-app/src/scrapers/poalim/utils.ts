import { format } from 'date-fns';
import { camelCase } from '../../helpers/misc.js';
import type {
  FilteredColumns,
  IGetPoalimForeignTransactionsResult,
  IGetPoalimIlsTransactionsResult,
} from '../../helpers/types.js';
import { NormalizedForeignTransaction } from './foreign-transactions.js';
import type { NormalizedIlsTransaction } from './ils-transactions.js';

function deepCompare(arg1: unknown, arg2: unknown): boolean {
  if (Object.prototype.toString.call(arg1) === Object.prototype.toString.call(arg2)) {
    if (
      Object.prototype.toString.call(arg1) === '[object Object]' ||
      Object.prototype.toString.call(arg1) === '[object Array]'
    ) {
      if (Object.keys(arg1 as object).length !== Object.keys(arg2 as object).length) {
        return false;
      }
      return Object.keys(arg1 as object).every((key: string) => {
        return deepCompare(
          (arg1 as { [key: string]: unknown })[key],
          (arg2 as { [key: string]: unknown })[key],
        );
      });
    }
    return arg1 === arg2;
  }
  return false;
}

export function isSameTransaction<
  T extends IGetPoalimForeignTransactionsResult | IGetPoalimIlsTransactionsResult,
  U = T extends IGetPoalimForeignTransactionsResult
    ? NormalizedForeignTransaction
    : NormalizedIlsTransaction,
>(transaction: U, dbTransaction: T, columns: FilteredColumns, ignoredColumns: string[] = []) {
  for (const column of columns) {
    if (ignoredColumns.includes(camelCase(column.column_name))) {
      continue;
    }

    const key = column.column_name as keyof T;
    const attribute = camelCase(key as string) as keyof U;
    const type = column.data_type;

    // normalize nullables
    const isNullable = column.is_nullable === 'YES';
    const dbValue = isNullable ? (dbTransaction[key] ?? null) : dbTransaction[key];
    const transactionValue = isNullable ? (transaction[attribute] ?? null) : transaction[attribute];

    switch (type) {
      case 'character varying':
      case 'USER-DEFINED':
      case 'text': {
        // string values
        if (dbValue !== transactionValue) {
          return false;
        }
        break;
      }
      case 'date': {
        // date values
        const dbDateString = dbValue ? format(dbValue as unknown as Date, 'yyyyMMdd') : null;
        const transactionDateString = transactionValue ? transactionValue.toString() : null;

        if (dbDateString !== transactionDateString) {
          return false;
        }
        break;
      }
      case 'bit': {
        // boolean values
        const transactionBit = transactionValue == null ? null : transactionValue.toString();
        if (transactionBit !== dbValue) {
          return false;
        }
        break;
      }
      case 'integer':
      case 'numeric':
      case 'bigint': {
        // numeric values
        // should consider 0 value, string numbers, etc
        const dbNumber = dbValue == null ? null : Number(dbValue);
        const transactionNumber = transactionValue == null ? null : Number(transactionValue);
        if (dbNumber !== transactionNumber) {
          return false;
        }
        break;
      }
      case 'json': {
        if (!deepCompare(dbValue, transactionValue)) {
          return false;
        }
        break;
      }
      default: {
        if (!isNullable) {
          throw new Error(`Unhandled type ${type}`);
        }
      }
    }
  }

  // case no diffs found
  return true;
}
