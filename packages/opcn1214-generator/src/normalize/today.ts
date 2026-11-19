/** The default save date (SPEC §6.2, §7.4): today in Asia/Jerusalem. */
import type { IsoDate } from '../model/input.js';

const JERUSALEM_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date of `now` in Asia/Jerusalem, as `YYYY-MM-DD`. */
export function todayInJerusalem(now: Date = new Date()): IsoDate {
  const parts = new Map(JERUSALEM_DATE.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
}
