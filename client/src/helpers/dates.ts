// import moment from 'moment';
import { format } from 'date-fns';

export const parseMonth = (month?: string): string | undefined => {
  if (!month) {
    return undefined;
  }

  const numMonth = Number(month);
  if (Number.isNaN(numMonth) || numMonth < 0 || numMonth > 12) {
    return undefined;
  }

  if (month.length === 1) {
    return `0${month}`;
  }

  return month;
};

export const parseYear = (year?: string): string | undefined => {
  if (!year) {
    return undefined;
  }

  const numYear = Number(year);
  if (Number.isNaN(numYear) || numYear < 2000 || numYear > 2030) {
    return undefined;
  }

  return year;
};

export function hashDateFormat(date: Date): string {
  return format(new Date(date), 'yyyy/MM/dd');
}

export function clearTimeFromDate(date: Date): string {
  return format(new Date(date), 'yyyy-MM-dd');
}
