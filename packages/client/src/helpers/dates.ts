import { format } from 'date-fns';

export function formatTimelessDateString(date: Date): TimelessDateString {
  return format(date, 'yyyy-MM-dd') as TimelessDateString;
}

/**
 * Formats a `yyyy-mm-dd` calendar day for display (`dd/MM/yy` by default) straight from its parts,
 * without going through a `Date`, so no timezone can move it to another day.
 */
export function formatTimelessDate(
  date: TimelessDateString,
  pattern: 'dd/MM/yy' | 'dd/MM/yyyy' = 'dd/MM/yy',
): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${pattern === 'dd/MM/yy' ? year.slice(-2) : year}`;
}

type addZero<T> = T | 0;
type oneToFour = 1 | 2 | 3 | 4;
type oneToNine = oneToFour | 5 | 6 | 7 | 8 | 9;
type d = addZero<oneToNine>;
type YYYY = `20${addZero<oneToFour>}${d}`;
type MM = `0${oneToNine}` | `1${0 | 1 | 2}`;
type DD = `${0}${oneToNine}` | `${1 | 2}${d}` | `3${0 | 1}`;

export type TimelessDateString = `${YYYY}-${MM}-${DD}`;
