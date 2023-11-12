import type { IGetChargesByIdsResult } from '@modules/charges/types';

export function getSalaryMonth(month: IGetChargesByIdsResult): string | null {
  if (month.user_description?.length) {
    const description = month.user_description?.toLocaleLowerCase();
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

    // search for "[month name] yyyy" in description
    const dateRegex3 =
      /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|(nov|dec)(?:ember)?) (?:19[7-9]\d|2\d{3})\b/;
    const matches3 = description.match(dateRegex3);
    if (matches3?.length) {
      const match = matches3[0];
      const [monthName, year] = match.split(' ');
      let month = '';
      switch (monthName) {
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
      if (month !== '') {
        const adjustedMonth = `${year}-${month}`;
        return adjustedMonth;
      }
    }
  }
  const date = month.transactions_min_event_date;
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
