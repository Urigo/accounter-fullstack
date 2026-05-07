import type { SwiftTransaction } from '@accounter/modern-poalim-scraper';
import type { Currency } from './gql/index.js';

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

export function convertPoalimCurrencyCodeToSymbol(code: number): Currency {
  switch (code) {
    case 19:
      return 'USD';
    case 27:
      return 'GBP';
    case 36:
      return 'AUD';
    case 51:
      return 'SEK';
    case 100:
      return 'EUR';
    case 140:
      return 'CAD';
    case 248:
      return 'JPY';
    default:
      throw new Error(`New Poalim account currency - ${code}`);
  }
}

function getPoalimSwiftCodeExtensions(
  swiftTransferDetailsList: SwiftTransaction['swiftTransferDetailsList'],
  index: number,
): string {
  if (index >= swiftTransferDetailsList.length) {
    return '';
  }
  if (swiftTransferDetailsList[index].swiftTransferAttributeCode !== null) {
    return '';
  }

  const value = swiftTransferDetailsList[index].swiftTransferAttributeValue;
  return `\n${value}${getPoalimSwiftCodeExtensions(swiftTransferDetailsList, index + 1)}`;
}

export function findPoalimSwiftElement(
  transaction: SwiftTransaction,
  attribute: string,
  defaultEmptyString: boolean = false,
) {
  const emptyValue = defaultEmptyString ? ' ' : null;
  const index = transaction.swiftTransferDetailsList.findIndex(
    element => element.swiftTransferAttributeCode === attribute,
  );

  // if the attribute is not found, return empty value
  if (index === -1) {
    return emptyValue;
  }
  let value = transaction.swiftTransferDetailsList[index].swiftTransferAttributeValue;

  // if the value is null or undefined, return empty value
  if (value === null || value === undefined) {
    return emptyValue;
  }

  // look for value extensions
  value += getPoalimSwiftCodeExtensions(transaction.swiftTransferDetailsList, index + 1);

  return value;
}
