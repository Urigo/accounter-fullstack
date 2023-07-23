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
