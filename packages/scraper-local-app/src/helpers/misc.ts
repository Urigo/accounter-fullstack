import { format } from 'date-fns';
import type { Logger } from '../logger.js';
import type { FilteredColumns } from './types.js';

export function camelCase(str: string) {
  const res = str
    .replace(/:/g, '_')
    .split('_')
    .map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1)))
    .join('');
  return res;
}

export function reverse(s: string) {
  return s.split('').reverse().join('');
}

/**
 *
 * @param numberDate
 * @returns
 * @throws Error if the number date is not in the format of YYYYMMDD
 * @example
 * convertNumberDateToString(20220101) // '2022-01-01'
 * convertNumberDateToString(2022011) // Error: Invalid number date
 */
export function convertNumberDateToString(numberDate: number) {
  if (numberDate < 10_000_000 || numberDate > 99_999_999) {
    throw new Error('Invalid number date');
  }
  const stringDate = numberDate.toString();
  const year = stringDate.substring(0, 4);
  const month = stringDate.substring(4, 6);
  const day = stringDate.substring(6, 8);
  return `${year}-${month}-${day}`;
}

export function newAttributesChecker<T extends object>(
  transaction: T,
  columnNames: string[],
  logger: Logger,
  accountNickname: string,
  knownOptionals: string[] = [],
) {
  const allKeys = Object.keys(transaction);

  const InTransactionNotInDB = allKeys.filter(
    x => !columnNames.includes(x) && !knownOptionals.includes(x),
  );
  const inDBNotInTransaction = columnNames.filter(
    x => !allKeys.includes(x) && !knownOptionals.includes(x),
  );
  if (InTransactionNotInDB.length) {
    logger.log(`New ${accountNickname} keys, in DB missing from transaction`, inDBNotInTransaction);
  }
  if (InTransactionNotInDB.length) {
    logger.log(`New ${accountNickname} keys, in transaction missing from DB`, InTransactionNotInDB);
  }
}

export function fillInDefaultValues<T extends object>(
  transaction: T,
  columns: FilteredColumns,
  logger: Logger,
  accountNickname: string,
) {
  const allKeys = Object.keys(transaction);
  const existingFields = columns.map(column => ({
    name: camelCase(column.column_name ?? '') as string | 'id',
    nullable: column.is_nullable === 'YES',
    type: column.data_type,
    defaultValue: column.column_default,
  }));

  const inDBNotInTransaction = existingFields.filter(x => !allKeys.includes(x.name) && !x.nullable);

  for (const key of inDBNotInTransaction) {
    if (key.name === 'id') {
      continue;
    }
    if (key.defaultValue) {
      logger.log(`${accountNickname}: Cannot autofill ${key.name} in with ${key.defaultValue}`);
    } else {
      switch (key.type) {
        case 'integer':
        case 'bit':
          transaction[key.name as keyof T] = 0 as never;
          break;
        default:
          logger.log(
            `${accountNickname}: Cannot autofill ${key.name}, no default value for ${key.type}`,
          );
      }
    }
  }
}

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

export function isSameTransaction<T extends object, U extends object>(
  transaction: U,
  dbTransaction: T,
  columns: FilteredColumns,
  ignoredColumns: string[] = [],
) {
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
