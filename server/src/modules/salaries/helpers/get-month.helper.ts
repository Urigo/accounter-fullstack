import type { IGetChargesByIdsResult } from '@modules/charges/types';

function convertMonthNameToNumber(monthName: string): string | null {
  const lowerCasedName = monthName.toLocaleLowerCase();
  let month: string | null = null;
  switch (lowerCasedName) {
    case 'january':
    case 'jan':
      month = '01';
      break;
    case 'february':
    case 'feb':
      month = '02';
      break;
    case 'march':
    case 'mar':
      month = '03';
      break;
    case 'april':
    case 'apr':
      month = '04';
      break;
    case 'may':
      month = '05';
      break;
    case 'june':
    case 'jun':
      month = '06';
      break;
    case 'july':
    case 'jul':
      month = '07';
      break;
    case 'august':
    case 'aug':
      month = '08';
      break;
    case 'september':
    case 'sep':
      month = '09';
      break;
    case 'october':
    case 'oct':
      month = '10';
      break;
    case 'november':
    case 'nov':
      month = '11';
      break;
    case 'december':
    case 'dec':
      month = '12';
      break;
    default:
      break;
  }
  return month;
}

export function getSalaryMonth(charge: IGetChargesByIdsResult): string | null {
  if (charge.user_description?.length) {
    const description = charge.user_description?.toLocaleLowerCase();
    // search for "yyyy-mm" in description
    const dateRegex = /(\d{4})-(\d{2})/;
    const matches = description.match(dateRegex);
    if (matches?.length) {
      const month = matches[0];
      return month;
    }

    // search for "mm-yyyy" in description
    const dateRegex2 = /(\d{2})-(\d{4})/;
    const matches2 = description.match(dateRegex2);
    if (matches2?.length) {
      const month = matches2[0];
      const adjustedMonth = month.split('-').reverse().join('-');
      return adjustedMonth;
    }

    // search for month name in description
    const dateRegex3 =
      /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|(nov|dec)(?:ember)?)\b/;

    const matches3 = description.match(dateRegex3);
    if (matches3?.length) {
      const monthName = matches3[0];
      const month = convertMonthNameToNumber(monthName);

      if (month) {
        // try to search for year in description
        const dateRegex4 =
          /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|(nov|dec)(?:ember)?) (?:19[7-9]\d|2\d{3})\b/
        const matches4 = description.match(dateRegex4);
        if (matches4?.length) {
          const year = matches4[0].split(' ')[1];
          if (year) {
            const adjustedMonth = `${year}-${month}`;
            return adjustedMonth;
          }
        }

        const transactionDate = charge.transactions_min_event_date ?? charge.transactions_min_debit_date;
        if (transactionDate) {
          let year = transactionDate.getFullYear();
          
          // case payment date is in Jan/Feb and salary month is Nov/Dec, use date's prev year
          if (transactionDate.getMonth() < 2 && month > '10') {
            year--;
          }
          const adjustedMonth = `${year}-${month}`;
          return adjustedMonth;
        }
      }

    }
  }
  const date = charge.transactions_min_event_date;
  if (date) {
    const day = date.getDate();
    if (day > 25) {
      const month = date.toISOString().slice(0, 7);
      return month;
    }
    if (day < 15) {
      const adjustedDate = new Date(date);
      adjustedDate.setMonth(date.getMonth() - 1);
      const month = adjustedDate.toISOString().slice(0, 7);
      return month;
    }
  }
  return null;
}
