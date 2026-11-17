/** Date codec (SPEC §4.2): ISO `YYYY-MM-DD` in the model, `DD/MM/YYYY` in the file. */
import type { CodeKind, FieldKind } from '../layout/types.js';
import { blank, checkLength, invalid } from './numeric.js';
import { CodecDecodeError, type Codec } from './types.js';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** `d` is a digit, any other character must match literally. */
const FILE_DATE_PATTERN = 'dd/dd/dddd';

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function invalidDate(raw: string, offset: number): CodecDecodeError {
  return new CodecDecodeError('date', offset, `Invalid DD/MM/YYYY date "${raw}"`);
}

const dateCodec: Codec = {
  encode(value, shape) {
    if (value === undefined) {
      return blank(shape);
    }
    const match = typeof value === 'string' ? ISO_DATE.exec(value) : null;
    if (
      !match ||
      !isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3])) ||
      shape.length !== FILE_DATE_PATTERN.length
    ) {
      throw invalid(value, shape, `a real calendar date YYYY-MM-DD in a field of width 10`);
    }
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  },
  decode(raw, shape) {
    checkLength(raw, shape);
    if (shape.type === 'alphanumeric' && raw.trim() === '') {
      return undefined;
    }
    for (let index = 0; index < FILE_DATE_PATTERN.length; index++) {
      const expected = FILE_DATE_PATTERN[index];
      const char = raw[index];
      const ok =
        char !== undefined && (expected === 'd' ? char >= '0' && char <= '9' : char === expected);
      if (!ok) {
        throw invalidDate(raw, index);
      }
    }
    if (raw.length !== FILE_DATE_PATTERN.length) {
      throw invalidDate(raw, FILE_DATE_PATTERN.length);
    }
    const day = raw.slice(0, 2);
    const month = raw.slice(3, 5);
    const year = raw.slice(6, 10);
    if (!isCalendarDate(Number(year), Number(month), Number(day))) {
      throw invalidDate(raw, 0);
    }
    return `${year}-${month}-${day}`;
  },
};

export const DATE_CODECS = {
  date: dateCodec,
} as const satisfies Partial<Record<FieldKind | CodeKind, Codec>>;
