import { format } from 'date-fns';
import type { TimelessDateString } from '@shared/types';

function parseIntRound(v: number) {
  return Math.trunc(v + Math.sign(v) / 2);
}

export function stringNumberRounded(number: string): number {
  return parseIntRound((parseFloat(number) + Number.EPSILON) * 100) / 100;
}

export function numberRounded(number: number): number {
  return parseIntRound((number + Number.EPSILON) * 100) / 100;
}

export function isTimelessDateString(date: string): date is TimelessDateString {
  const parts = date.split('-');
  if (parts.length !== 3) {
    return false;
  }
  const [year, month, day] = parts;
  //year
  const yearNum = Number(year);
  if (Number.isNaN(yearNum) || yearNum < 2000 || yearNum > 2049) {
    return false;
  }
  // month
  const monthNum = Number(month);
  if (Number.isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return false;
  }
  // day
  const dayNum = Number(day);
  if (Number.isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
    return false;
  }
  return true;
}

export function isUUID(raw: string) {
  const regexExp =
    /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
  return regexExp.test(raw);
}

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

/**
 * @description
 * Extract month from description
 * @param rawDescription string - description to extract month from
 * @param eventDate Date - optional, if provided, will use it to determine year
 * @returns month in format yyyy-mm, else null
 */
export function getMonthFromDescription(rawDescription: string, eventDate?: Date): string[] | null {
  if (!rawDescription.length) {
    return null;
  }
  const description = rawDescription?.toLocaleLowerCase();
  // search for "yyyy-mm" in description
  const dateRegex = /\b(\d{4})-(\d{2})\b/;
  const matches = description.match(dateRegex);
  if (matches?.length) {
    const month = matches[0];
    return [month];
  }

  // search for "mm-yyyy" in description
  const dateRegex2 = /\b(\d{2})-(\d{4})\b/;
  const matches2 = description.match(dateRegex2);
  if (matches2?.length) {
    const month = matches2[0];
    const adjustedMonth = month.split('-').reverse().join('-');
    return [adjustedMonth];
  }

  // search for "mm/yyyy" in description
  const dateRegex3 = /\b(\d{2})\/(\d{4})\b/;
  const matches3 = description.match(dateRegex3);
  if (matches3?.length) {
    // case two month
    const dateRegex3double = /\b(\d{2})-(\d{2})\/(\d{4})\b/;
    const matches3double = description.match(dateRegex3double);
    if (matches3double?.length) {
      const [_dateString, monthA, monthB, year] = matches3double;
      return [`${year}-${monthA}`, `${year}-${monthB}`];
    }
    // case one month
    const month = matches3[0];
    const adjustedMonth = month.split('/').reverse().join('-');
    return [adjustedMonth];
  }

  // search for "mm/yy" in description
  const dateRegex4 = /\b(\d{2})\/(\d{2})\b/;
  const matches4 = description.match(dateRegex4);
  if (matches4?.length) {
    const month = matches4[0];
    const adjustedMonth = '20' + month.split('/').reverse().join('-');
    return [adjustedMonth];
  }

  // search for month name in description
  const dateRegex5 =
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|(nov|dec)(?:ember)?)\b/g;

  const monthNames = description.match(dateRegex5);
  if (monthNames?.length) {
    const dateStrings = [];
    for (const monthName of monthNames) {
      const month = convertMonthNameToNumber(monthName);

      if (month) {
        // try to search for year in description
        const dateRegex5 =
          /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|(nov|dec)(?:ember)?) (?:19[7-9]\d|2\d{3})\b/g;
        const matches5 = description.match(dateRegex5);
        if (matches5?.length) {
          const year = matches5[0].split(' ')[1];
          if (year) {
            const adjustedMonth = `${year}-${month}`;
            dateStrings.push(adjustedMonth);
            continue;
          }
        }

        if (eventDate) {
          let year = eventDate.getFullYear();

          // case date is in Jan/Feb and salary month is Nov/Dec, use date's prev year
          if (eventDate.getMonth() < 2 && month > '10') {
            year--;
          }
          const adjustedMonth = `${year}-${month}`;
          dateStrings.push(adjustedMonth);
        }
      }
    }
    if (dateStrings.length) {
      return dateStrings;
    }
  }
  return null;
}

export function dateToTimelessDateString(date: Date): TimelessDateString {
  return format(date, 'yyyy-MM-dd') as TimelessDateString;
}

export function optionalDateToTimelessDateString(date?: Date | null): TimelessDateString | null {
  if (!date) {
    return null;
  }
  return dateToTimelessDateString(date) as TimelessDateString;
}
